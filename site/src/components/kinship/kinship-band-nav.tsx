"use client";

// 系譜図の横方向の索引（王朝バンドへのジャンプ＋現在地表示）と表示倍率。
//
// 1章の系譜図は最大6228px幅ある。デスクトップの表示領域は約1150px（18%）、390pxの
// 端末では約345px（5.5%）しか映らない。バンド見出し（「前漢」など）は図の最上部に
// 描かれているため、少し下へスクロールすると「いまどの王朝を見ているか」を示すものが
// 画面から消える。横スクロールバー以外に位置の手掛かりが無かった。
//
// 【React state を使わない理由】現在地の更新は React state に持たない。持つと
// スクロールのたびに KinshipChart 全体（1章あたり最大445ノードのSVG）が再描画され、
// サイト共通の「ホバー状態をチャートに持たない」方針と同じ問題を起こす。
// 現在地の反映は rAF の中で DOM 属性を直接書き換える（/timeline のラベルクランプと
// 同じ手法）。
//
// 表示倍率は既定100%＝従来と1ピクセルも変わらない描画。縮小は「全体のどこを見て
// いるか」を掴むための補助で、文字が読める倍率ではない（100%でも6228px幅なので、
// 縮小すると字は潰れる）。系譜そのもの（ノードの座標）には一切触れていない。

import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  HorizontalScrollHint,
  useHorizontalScrollEdges,
} from "@/components/charts/horizontal-scroll-hint";
import { BELOW_KINSHIP_NAV } from "@/components/kinship/kinship-chapter-nav";

export type KinshipBand = { label: string; x: number; width: number };

/** 表示倍率の選択肢。既定(1)は従来の描画と同一。 */
export const KINSHIP_SCALES = [
  { value: 1, label: "100%" },
  { value: 0.6, label: "60%" },
  { value: 0.35, label: "35%" },
] as const;

const PILL_ACTIVE = "border-seal bg-seal text-seal-foreground";
const PILL_IDLE =
  "border-border bg-background text-foreground/80 hover:border-seal/50 hover:bg-accent/60 hover:text-seal";

export function KinshipBandNav({
  bands,
  scrollRef,
  scale,
  onScaleChange,
  chapterTitle,
}: {
  /** ラベルのあるバンドだけを、図の左から順に渡すこと。 */
  bands: KinshipBand[];
  /** 系譜図の横スクロール枠。 */
  scrollRef: RefObject<HTMLDivElement | null>;
  scale: number;
  onScaleChange: (scale: number) => void;
  chapterTitle: string;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const rafRef = useRef(0);
  // ピルを押した直後は、スクロール由来の再判定でその王朝の点灯を奪わせない
  // （枠が広いと、飛んだ先の狭いバンドより隣の大きなバンドのほうが面積で勝つ）。
  // スムーススクロールが終わるまでのあいだだけ立てる。
  const pinnedRef = useRef(false);
  const pinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 現在の点灯位置。-1 は「どれも点灯しない」（全体が枠に収まっている状態）で、
  // -2 は「未確定」。倍率変更時のリセットに -1 を使うと、点灯なしへ移る場合に
  // 「変化なし」と判定されてDOMが更新されないため、専用の値を分けている。
  const activeRef = useRef<number>(-2);
  // ピル行の端フェード。スクロール枠は listRef（外部refとして渡す）。
  const { atStart, atEnd, onScroll: onPillScroll } =
    useHorizontalScrollEdges<HTMLUListElement>(listRef);

  /** 表示領域の中央にあるバンドを求め、ピルの見た目をDOM直書きで更新する。 */
  const syncActive = useCallback(() => {
    const el = scrollRef.current;
    const list = listRef.current;
    if (!el || !list) return;
    // 図全体が枠に収まっているときは「いまどこ」が無い。縮小表示で全体が入った
    // 場合にどれか1つを点灯させると、見ていない王朝を現在地と誤って示す。
    const overflows = el.scrollWidth > el.clientWidth + 1;
    let next = -1;
    if (overflows) {
      // 表示範囲と重なる面積がいちばん大きいバンドを現在地とする（図の座標系に
      // 戻して比べる）。中央点だけで判定すると、狭いバンドは枠の中央に来る前に
      // 通り過ぎてしまい一度も点灯しない。
      const a = el.scrollLeft / scale;
      const b = (el.scrollLeft + el.clientWidth) / scale;
      let best = 0;
      bands.forEach((band, i) => {
        const ov = Math.min(b, band.x + band.width) - Math.max(a, band.x);
        if (ov > best) {
          best = ov;
          next = i;
        }
      });
    }
    if (pinnedRef.current) return;
    if (next === activeRef.current) return;
    activeRef.current = next;
    const items = list.querySelectorAll<HTMLElement>("[data-band]");
    items.forEach((item, i) => {
      const on = i === next;
      item.className = `inline-block rounded-full border px-3 py-1 text-sm transition-colors ${
        on ? PILL_ACTIVE : PILL_IDLE
      }`;
      if (on) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
    // 現在地のピルを見える範囲へ送る（バンドが多い章では狭い画面に数個しか映らない）。
    const pill = next >= 0 ? items[next] : null;
    if (!pill) return;
    const margin = 24;
    const left = pill.offsetLeft - margin;
    const right = pill.offsetLeft + pill.offsetWidth + margin;
    let to = list.scrollLeft;
    if (left < list.scrollLeft) to = left;
    else if (right > list.scrollLeft + list.clientWidth) to = right - list.clientWidth;
    if (to !== list.scrollLeft) list.scrollLeft = Math.max(0, to);
  }, [bands, scrollRef, scale]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(syncActive);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // 倍率変更・初回マウント時にも合わせる（-2 = 未確定にしてから再計算する）。
    activeRef.current = -2;
    syncActive();
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafRef.current);
      if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
    };
  }, [scrollRef, syncActive]);

  const jumpTo = (band: KinshipBand, index: number) => {
    const el = scrollRef.current;
    const list = listRef.current;
    if (!el || !list) return;
    // 押した王朝をすぐ点灯させ、スムーススクロールが終わるまで再判定を止める。
    activeRef.current = index;
    pinnedRef.current = true;
    if (pinTimerRef.current) clearTimeout(pinTimerRef.current);
    pinTimerRef.current = setTimeout(() => {
      pinnedRef.current = false;
    }, 800);
    list.querySelectorAll<HTMLElement>("[data-band]").forEach((item, i) => {
      const on = i === index;
      item.className = `inline-block rounded-full border px-3 py-1 text-sm transition-colors ${
        on ? PILL_ACTIVE : PILL_IDLE
      }`;
      if (on) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
    // バンドの左端を枠の左に寄せる（少し手前を残して、直前の王朝との接続が見える）。
    const left = band.x * scale - 32;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  };

  if (bands.length === 0) return null;

  return (
    <div
      // 章ジャンプ(z-30)の真下に貼り付く。系譜図の枠の中に置いてあるので、その章を
      // 見ているあいだだけ出る。図の年ラベルのstickyオーバーレイ(z-20)より上。
      className="sticky z-30 flex items-center gap-3 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur"
      style={{ top: BELOW_KINSHIP_NAV }}
    >
      <span className="hidden shrink-0 text-xs text-muted-foreground lg:inline">
        王朝へジャンプ
      </span>
      <div className="relative min-w-0 flex-1">
        <ul
          ref={listRef}
          onScroll={onPillScroll}
          className="flex min-w-0 gap-2 overflow-x-auto whitespace-nowrap py-0.5"
        >
          {bands.map((b, i) => (
            <li key={`${b.label}:${b.x}`}>
              <button
                type="button"
                data-band
                onClick={() => jumpTo(b, i)}
                className={`inline-block rounded-full border px-3 py-1 text-sm transition-colors ${PILL_IDLE}`}
              >
                {b.label}
              </button>
            </li>
          ))}
        </ul>
        <HorizontalScrollHint atStart={atStart} atEnd={atEnd} showBadge={false} />
      </div>
      <label className="flex shrink-0 items-center gap-1.5">
        <span className="sr-only">{chapterTitle}の表示倍率</span>
        <select
          value={scale}
          onChange={(e) => onScaleChange(Number(e.target.value))}
          className="h-8 rounded-lg border border-input bg-transparent pl-2 pr-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {KINSHIP_SCALES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
