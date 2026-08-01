"use client";

// 押したリンクの「遷移待ち」表示（2026-08-01）。
//
// このサイトのリンクは素の <Link>（ソフトナビゲーション）で、押してから遷移が
// 終わるまで**画面が一切変わらなかった**。プリフェッチが効いていれば一瞬で
// 終わるが、365枚のカードが並ぶ /emperors では画面外のカードまでは温まって
// おらず、押してから間が空く。
//
// `useLinkStatus` は **<Link> の子孫でだけ** 使える（next/link・Next 16 の API・
// docs は node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md）。
// 状態を持つのはこの小さな子コンポーネントだけなので、365枚のカード本体
// （memo 済み）は再レンダリングされない。
//
// **待っていないときは何も描かない。** 静的HTMLに365個のスピナーを載せない
// ためと、透明な要素を敷いてカードのホバー判定に触らないため。

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * カード全面にかぶせる遷移待ち。押したカードだけが沈んで見える。
 * 置き場所の親に `relative` が要る。
 */
export function LinkPendingOverlay() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      // クリック直後の見た目なので、下のカードの hover/active を殺さない。
      // **読み上げには出さない（装飾）** — 出たときに初めて DOM へ入る要素は
      // ライブリージョンにしても読まれない（既にある領域の変化しか拾われない）。
      // 365枚ぶんの常設ライブリージョンを置く話でもないので、支援技術への
      // 通知は遷移そのもの（新しいページの読み上げ）に任せる。
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-md bg-card/70"
    >
      {/* 「視差効果を減らす」環境ではスピナーが固まるので出さない
          （globals.css が animation-iteration-count: 1 を一括で当てる）。
          その場合もかぶせた白い面そのものが押したことを示す。 */}
      <Spinner className="size-5 text-seal motion-reduce:hidden" />
    </span>
  );
}

/** 文字リンクの右に付ける遷移待ち（ナビ・表の行など、面を持たないリンク用）。 */
export function LinkPendingDot({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    // 上と同じ理由で装飾扱い（リンクの読み上げ名に「読み込み中」を混ぜない）。
    <Spinner
      className={cn(
        "ml-1.5 inline-block size-3 align-middle text-seal motion-reduce:hidden",
        className,
      )}
      aria-hidden
    />
  );
}
