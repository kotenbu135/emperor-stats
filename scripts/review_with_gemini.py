#!/usr/bin/env python3
"""`review/` の依頼文を Gemini API へ投げ、返ってきた指摘表を `review/result/` へ保存する。

`export_profile_review.py` が書き出したファイルは**そのままで完結した依頼文**（観点・
返し方・途中欠けの確認まで入っている）なので、ここでやるのは投げて保存するだけ。
プロンプトを組み立て直さない — 組み立て直すと、人へ渡した依頼文と機械へ渡した依頼文が
別物になり、返ってきた指摘がどの観点に対する答えなのか後から辿れなくなる。

**認証は API キー（AI Studio）だけ。** gemini CLI の OAuth（oauth-personal）は
2026-08-12 時点で "This client is no longer supported for Gemini Code Assist for
individuals" を返して使えない。`GEMINI_API_KEY` を環境変数か `--key-file` で渡す。

**一括実行の前に必ず小規模検証を通す**（`R-API-BATCH`）。`--limit 2` で数本だけ投げ、
返り方・費用・所要時間を見てから件数を提示して許可を取り、その後に全件を流す。

使い方:
    python3 scripts/review_with_gemini.py --list-models          # 使えるモデルを見る
    python3 scripts/review_with_gemini.py --limit 2              # 小規模検証
    python3 scripts/review_with_gemini.py                        # review/*.md 全部
    python3 scripts/review_with_gemini.py review/131-chen-wudi.md
    python3 scripts/review_with_gemini.py --overwrite            # 済みも取り直す

既定では**出力が既に在るファイルは飛ばす**ので、途中で止めてもそのまま再開できる。
1件ごとに `review/result/_runs.jsonl` へ使用トークンと所要秒を残す（費用の実測用）。

返ってきた表は保存する前に2つだけ機械で見る（内容の当否は見ない）:

1. **箇所の番号が本文に在るか** — 依頼文は「[番号] で指す」と言っているので、本文に
   無い番号が返ったら幻の箇所を指している。件数を警告に出す（保存はする）
2. **「途中で欠けている」返答か** — 依頼文がそう返すよう指示している形。該当したら
   指摘0件として保存し、警告に出す
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-2.5-pro"

# 依頼文はファイル側に全部入っている。ここで足すのは「表だけ返す」の念押しだけ。
TAIL = (
    "\n\n---\n\n上の依頼文に従ってレビューし、**指摘の表だけ**を返してください。"
    "前置き・後書き・要約・書き直し案は要りません。"
    "指摘が1件も無ければ表の見出しだけを返してください。"
)

TAG = re.compile(r"^\[([0-9-]+)\]", re.M)
ROW = re.compile(r"^\|\s*\[([0-9-]+)\]\s*\|", re.M)
TRUNCATED = re.compile(r"欠けて|途中で切れ|番号が飛")


def api_key(args) -> str:
    if args.key_file:
        return Path(args.key_file).read_text(encoding="utf-8").strip()
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        if os.environ.get(name):
            return os.environ[name].strip()
    sys.exit(
        "GEMINI_API_KEY がありません。AI Studio のキーを環境変数か --key-file で渡してください。"
    )


def post(url: str, payload: dict | None, timeout: int) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="GET" if data is None else "POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode("utf-8"))


def call(key: str, model: str, text: str, timeout: int, retries: int) -> dict:
    """1件投げる。429・5xx は待って投げ直す（待ち時間は Retry-After を見ない指数バックオフ）。"""
    url = f"{API}/models/{model}:generateContent?key={key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": text}]}],
        "generationConfig": {"temperature": 0.2},
    }
    last = ""
    for attempt in range(retries + 1):
        try:
            return post(url, payload, timeout)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:300]
            last = f"HTTP {e.code}: {body}"
            if e.code not in (408, 429, 500, 502, 503, 504) or attempt == retries:
                raise RuntimeError(last) from None
        except (urllib.error.URLError, TimeoutError) as e:
            last = f"{type(e).__name__}: {e}"
            if attempt == retries:
                raise RuntimeError(last) from None
        time.sleep(min(60, 5 * 2**attempt))
    raise RuntimeError(last)


def answer_text(res: dict) -> str:
    for cand in res.get("candidates") or []:
        parts = (cand.get("content") or {}).get("parts") or []
        text = "".join(p.get("text") or "" for p in parts).strip()
        if text:
            return text
        if cand.get("finishReason") and cand["finishReason"] != "STOP":
            raise RuntimeError(f"finishReason={cand['finishReason']}（本文なし）")
    raise RuntimeError(f"応答に本文がありません: {json.dumps(res, ensure_ascii=False)[:300]}")


def review_one(path: Path, out_dir: Path, key: str, args) -> dict:
    started = time.time()
    source = path.read_text(encoding="utf-8")
    res = call(key, args.model, source + TAIL, args.timeout, args.retries)
    text = answer_text(res)

    tags = set(TAG.findall(source))
    rows = ROW.findall(text)
    unknown = sorted({r for r in rows if r not in tags})
    truncated = bool(TRUNCATED.search(text)) and not rows

    out = out_dir / path.name
    header = f"<!-- {args.model} / {path.name} / 段落{len(tags)} / 指摘{len(rows)} -->\n\n"
    out.write_text(header + text.rstrip() + "\n", encoding="utf-8")

    usage = res.get("usageMetadata") or {}
    return {
        "file": path.name,
        "model": args.model,
        "rows": len(rows),
        "unknownTags": unknown,
        "truncatedReply": truncated,
        "seconds": round(time.time() - started, 1),
        "promptTokens": usage.get("promptTokenCount"),
        "outputTokens": usage.get("candidatesTokenCount"),
        "thoughtTokens": usage.get("thoughtsTokenCount"),
        "totalTokens": usage.get("totalTokenCount"),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="review/ の依頼文を Gemini API でレビューさせる")
    ap.add_argument("files", nargs="*", help="依頼文のファイル（既定: review/*.md）")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--out", default="review/result", help="保存先（既定: review/result）")
    ap.add_argument("--limit", type=int, help="先頭からこの件数だけ（小規模検証用）")
    ap.add_argument("--concurrency", type=int, default=4, help="同時に投げる本数（既定: 4）")
    ap.add_argument("--timeout", type=int, default=300)
    ap.add_argument("--retries", type=int, default=4)
    ap.add_argument("--overwrite", action="store_true", help="保存済みも投げ直す")
    ap.add_argument("--key-file", help="API キーを書いたファイル")
    ap.add_argument("--list-models", action="store_true", help="使えるモデルを出して終わる")
    ap.add_argument("--dry-run", action="store_true", help="投げずに対象と件数だけ出す")
    args = ap.parse_args()

    if args.list_models:
        key = api_key(args)
        for m in post(f"{API}/models?key={key}&pageSize=200", None, 60).get("models") or []:
            if "generateContent" in (m.get("supportedGenerationMethods") or []):
                print(f"{m['name'].split('/')[-1]:36} in={m.get('inputTokenLimit')} out={m.get('outputTokenLimit')}")
        return 0

    paths = [Path(f) for f in args.files] or sorted((ROOT / "review").glob("*.md"))
    out_dir = ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    todo = [p for p in paths if args.overwrite or not (out_dir / p.name).exists()]
    if args.limit:
        todo = todo[: args.limit]
    print(f"対象 {len(paths)}本 / 未取得 {len(paths) - (len(paths) - len(todo)) if args.overwrite else len(todo)}本 / 今回投げる {len(todo)}本（{args.model}）")
    if args.dry_run or not todo:
        return 0

    key = api_key(args)
    log = out_dir / "_runs.jsonl"
    started = time.time()
    done: list[dict] = []
    fails: list[tuple[str, str]] = []

    def work(p: Path):
        try:
            return p, review_one(p, out_dir, key, args), None
        except Exception as e:  # 1本の失敗で全体を止めない（残りは再実行で埋まる）
            return p, None, str(e)

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        for p, rec, err in pool.map(work, todo):
            if err:
                fails.append((p.name, err))
                print(f"  × {p.name}  {err[:120]}", flush=True)
                continue
            done.append(rec)
            with log.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            marks = []
            if rec["unknownTags"]:
                marks.append(f"本文に無い番号 {'・'.join(rec['unknownTags'])}")
            if rec["truncatedReply"]:
                marks.append("「途中で欠けている」返答")
            note = ("  ⚠ " + " / ".join(marks)) if marks else ""
            print(f"  ○ {p.name}  指摘{rec['rows']}件  {rec['seconds']}秒{note}", flush=True)

    prompt = sum(r["promptTokens"] or 0 for r in done)
    output = sum((r["outputTokens"] or 0) + (r["thoughtTokens"] or 0) for r in done)
    print(
        f"\n{len(done)}本 成功 / {len(fails)}本 失敗 / 指摘 {sum(r['rows'] for r in done)}件"
        f" / {round(time.time() - started)}秒"
        f"\n入力 {prompt:,} トークン・出力（思考込み） {output:,} トークン"
    )
    if fails:
        print("失敗したファイル（そのまま再実行すれば未取得ぶんだけ投げ直す）:")
        for name, err in fails:
            print(f"  {name}: {err[:160]}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
