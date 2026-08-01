// 皇帝名・政権名・時代ラベルの読み（`../data/name-readings.json`・GitHub Issue #20）。
// 方針と機械ゲートは docs/site-design/RUBY_PLAN_2026-08-01.md。
//
// **ビルド時にだけ動くサーバー専用モジュール**（node:fs に依存する）。クライアントへは
// ルビ記法に変換済みの文字列だけが props で渡り、描画は components/ui/ruby-text.tsx。
//
// 読みは日本語の慣用読みで、正史原典から出る値ではない。だから emperors.json を
// 拡張せず別ファイルに置いている（紹介文 emperor-profiles.json と同じ理由）。
//
// キーは画面に出る平文そのもの、値は同じ文字列にルビ注釈を付けたもの。
// 同じ文字列が複数の皇帝で使われる廟号・諡号（武帝17人・明帝14人…計46件）は
// **読みが一意**なので、人物ごとの上書きは持たない（実測して確認済み・方針5-2節）。

import fs from "node:fs";
import path from "node:path";
import { assertValidRubySource, stripRuby } from "@/lib/ruby";

const readingsPath = path.join(
  process.cwd(),
  "..",
  "data",
  "name-readings.json",
);

const nameReadings = (
  JSON.parse(fs.readFileSync(readingsPath, "utf-8")) as {
    names: Record<string, string>;
  }
).names;

// 記法の破損と親文字の打ち間違いをビルドで止める。
// 「ルビを剥がすとキーに戻る」が成り立たない行は、親文字を書き間違えているか
// 対応する平文が変わったかのどちらかで、そのまま出すと画面の名前が変わってしまう。
for (const [plain, annotated] of Object.entries(nameReadings)) {
  assertValidRubySource(annotated, `name-readings.json の「${plain}」`);
  const stripped = stripRuby(annotated);
  if (stripped !== plain) {
    throw new Error(
      `name-readings.json の「${plain}」はルビを剥がすと「${stripped}」になります。` +
        `親文字はキーと1文字ずつ一致させてください`,
    );
  }
}

/**
 * 平文にルビ記法を付けて返す。未登録の文字列は**そのまま返す**（ルビ無しで素通し）。
 *
 * 717文字列が揃うまではビルドを止めない代わりに、`reportReadingCoverage()` が
 * 残件数を必ず出す。揃った時点でここを例外へ切り替えること
 * （緩いまま配信すると 2026-08-01 の肖像デプロイ事故と同じ形になる）。
 */
export function rubyOf(plain: string | null | undefined): string {
  if (!plain) return "";
  return nameReadings[plain] ?? plain;
}

/** 読みが登録済みか（未登録の一覧を数えるため）。 */
export function hasReading(plain: string): boolean {
  return plain in nameReadings;
}

let reported = false;

/**
 * ビルドログに `ふりがな: n/m 件` を出す。**未完成のまま配信されないための警報**なので
 * 静かにしないこと。同一プロセスで何度呼ばれても1回だけ出す。
 */
export function reportReadingCoverage(displayedNames: Iterable<string>): void {
  if (reported) return;
  reported = true;
  const all = new Set(displayedNames);
  const missing = [...all].filter((s) => !(s in nameReadings));
  const done = all.size - missing.length;
  const line = `ふりがな（Issue #20）: ${done}/${all.size} 件`;
  if (missing.length === 0) {
    console.log(`${line} — 全件そろいました。rubyOf を例外へ切り替えてください`);
    return;
  }
  console.log(
    `${line}（未登録 ${missing.length} 件・ルビ無しで素通し）例: ${missing
      .slice(0, 8)
      .join("・")}`,
  );
}
