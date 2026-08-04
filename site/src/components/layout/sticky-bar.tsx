"use client";

// 画面上端に固定される帯の外枠。**中身を持たない** — 節ジャンプ（/emperors・/about の
// `SectionJumpNav`）と表の絞り込み（/database）が同じ寸法・同じ止め位置・同じ重なりで
// 並ぶように、外側だけを1箇所に寄せてある（2026-08-04）。
//
// **高さ 48px は寸法ではなく契約**。この値は
//   - 節見出しを貼り付ける `top`（/emperors の15時代）
//   - 節の `scrollMarginTop`（ジャンプ先の着地位置）
//   - /database の表見出しを貼り付ける `top`
// を兼ねているので、中身が折り返して2行になると**見出しと着地位置が黙ってずれる**
// （tsc・lint・build はどれも落ちない）。中身を足す側は `tools/bar-audit.mjs` で実測する。

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 固定バーの高さ(px)。 */
export const STICKY_BAR_H = 48;

/**
 * 固定バーの真下の位置（ジャンプ先の scroll-margin-top・その下に貼り付ける
 * 見出しの top）。モバイルはサイトヘッダー(--chrome-top = 56px)も画面上端に
 * 固定されているため、バーの高さだけでは足りない。直値ではなくこの式を使うこと。
 */
export const BELOW_STICKY_BAR = `calc(var(--chrome-top) + ${STICKY_BAR_H}px)`;

export function StickyBar({
  as: Tag = "section",
  ariaLabel,
  innerWidth = "max-w-content",
  className,
  children,
}: {
  /** 帯の役目に合わせる。節ジャンプは `nav`、絞り込みだけの帯は `section`
   *  （`role="toolbar"` は矢印キー移動の実装を要求するので使わない）。 */
  as?: "nav" | "section";
  /** ランドマークの読み上げ名。 */
  ariaLabel: string;
  /** バーの中身を揃える列幅クラス。**そのページの本文列と必ず同じ値にする** —
   *  既定のデータページ幅（max-w-content = 1200px）のまま記事型ページ（/about・
   *  読み物幅）に置くと、中身だけが本文より左に飛び出す。 */
  innerWidth?: string;
  /** 左右の余白を打ち消す必要がある呼び出し元（既に padding された箱の中に
   *  置く場合）だけ渡す。例: "-mx-gutter md:-mx-gutter-wide" */
  className?: string;
  /** 帯に並べる中身。**幅の分岐は `@container/bar`（帯の内幅）で書くこと** —
   *  ビューポート幅で分岐しないこと。md 以上はサイドバー240pxが挟まるので、
   *  768px の画面でも帯の内幅は438pxしかない。 */
  children: ReactNode;
}) {
  return (
    <Tag
      aria-label={ariaLabel}
      // ページ全体を横断するスティッキーな段（z-30）。節見出し・横スクロールの
      // 端フェード（z-10）と図の中で位置を保つラベル（z-20）より上、画面に固定される
      // 要素（z-50）より下。
      className={cn(
        "sticky z-30 flex items-center border-b border-border bg-background/95 px-gutter backdrop-blur md:px-gutter-wide",
        className,
      )}
      // モバイルは sticky なサイトヘッダーの下に着ける。
      style={{ height: STICKY_BAR_H, top: "var(--chrome-top)" }}
    >
      {/* 帯（背景・下罫）は全幅のまま、中身だけ本文と同じ列幅に揃える。
          container query の基準はこの内側の箱にする（外枠は全幅＋左右 gutter で、
          そちらを基準にすると内幅と最大80pxずれて分岐が狂う）。
          **この2枚より深くしないこと** — tools/bar-audit.mjs が
          `:scope > div` を2回たどって内幅と行を測っている。 */}
      <div className={cn("@container/bar mx-auto h-full w-full", innerWidth)}>
        <div className="flex h-full items-center gap-2 @xl/bar:gap-3">
          {children}
        </div>
      </div>
    </Tag>
  );
}
