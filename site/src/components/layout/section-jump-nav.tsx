"use client";

// ページ内の節へ飛ぶ索引（画面上部に固定）。
//
// 「縦に長くスクロールで迷子になる」というユーザー指摘(2026-07-26)への対応。
// /emperors（365枚のカードで全高5万px超）と節が3つ以上あるページで使う。
//
// **2026-07-31 に「畳んで押したら開く」形へ変えた**（ユーザー決定）。
// それまでは節を丸ピルで横一列に並べていたが、/emperors の15時代は
// **1440px でも11個しか入らず**（scrollWidth 1390 / clientWidth 1015）、390px では3つ。
// 縦にスクロールするページの中に横スクロールする帯があるのは、/database の表で
// 「2重スクロールは操作性が悪い」として避けたのと同じ形だった。
// いまはバーに現在地1つだけを出し、押すと全節をポップオーバーで一覧する
// （どの幅でも全節が一度に見え、横スクロールは消える）。
//
// - 現在見ている節をバーに出す。判定はサイドバーメニュー・章ジャンプと
//   同じ IntersectionObserver・同じ帯（-20%/-55%）で、強調がずれないようにする
//
// 【観測対象の注意】id は「節の本体」に付けること。見出しに付けると、見出しが
// sticky でこのバーの真下に貼り付き続けるかぎり判定帯（画面の20%〜45%）に
// 一度も入らず、現在地が永久に更新されない。

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** 固定バーの高さ(px)。 */
export const SECTION_NAV_H = 48;

/**
 * ジャンプ先の scroll-margin-top / 節見出しを sticky にする場合の top。
 * モバイルはサイトヘッダー(--chrome-top = 56px)も画面上端に固定されているため、
 * バーの高さだけでは足りない。直値ではなくこの式を使うこと。
 */
export const BELOW_SECTION_NAV = `calc(var(--chrome-top) + ${SECTION_NAV_H}px)`;

export interface JumpItem {
  /** 節本体の要素id。 */
  id: string;
  label: string;
  /** ピルに添える件数（任意）。 */
  count?: number;
}

export function SectionJumpNav({
  items,
  label,
  className,
}: {
  items: JumpItem[];
  /** バー左端の見出し（例: "時代へジャンプ"）。狭い画面では出さない。 */
  label: string;
  /** 左右の余白を打ち消す必要がある呼び出し元（既に padding された箱の中に
   *  置く場合）だけ渡す。例: "-mx-gutter md:-mx-gutter-wide" */
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string>("");
  const [open, setOpen] = useState(false);

  // 節の集合は絞り込みで変わりうる。並びを1本の文字列にして依存に使い、
  // 中身が同じ再レンダリングでは observer を張り直さない。
  const idKey = items.map((i) => i.id).join(" ");

  useEffect(() => {
    // 節が0件のときはバー自体を描かない。state は次に節が現れた瞬間、
    // observe 直後の通知で上書きされるのでここでは戻さない。
    if (!idKey) return;
    const els = idKey
      .split(" ")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    // 【交差中の集合を持つ理由】IntersectionObserver は「閾値をまたいだ節」しか
    // entries に載せない。コールバックの entries だけを見て現在地を決めると、
    // **判定帯から出た節の通知だけが届いた回**（帯には別の節が居座っているが、
    // その節は状態が変わっていないので entries に載らない）で更新できず、
    // 現在地が前の節のまま固まる。実測: 先頭→送る→先頭へ戻すと、戻したあとも
    // 2番目の時代が出たままになる。節が全部ピルで並んでいた頃は強調のずれで済んだが、
    // 畳んだいまは**バーに出る唯一の文字が間違う**ので、交差中の集合を自分で持つ。
    const intersecting = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) intersecting.add(e.target.id);
          else intersecting.delete(e.target.id);
        }
        // 帯に複数入っていることがあるので、いちばん上の節を現在地にする。
        const top = els
          .filter((el) => intersecting.has(el.id))
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        if (top) setActiveId(top.id);
      },
      { rootMargin: "-20% 0px -55% 0px" },
    );
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [idKey]);

  if (items.length === 0) return null;

  // 現在地が未確定（読み込み直後・observer の初回通知前）は先頭の節を出す。
  // 空文字のまま出すとトリガーの幅がゼロ幅から実幅へ跳ねて CLS になる。
  const current = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <nav
      aria-label={label}
      // ページ全体を横断するスティッキーな索引の段（z-30）。節見出し・横スクロールの
      // 端フェード（z-10）と図の中で位置を保つラベル（z-20）より上、画面に固定される
      // 要素（z-50）より下。
      className={cn(
        "sticky z-30 flex items-center border-b border-border bg-background/95 px-gutter backdrop-blur md:px-gutter-wide",
        className,
      )}
      // モバイルは sticky なサイトヘッダーの下に着ける。
      style={{ height: SECTION_NAV_H, top: "var(--chrome-top)" }}
    >
      {/* 帯（背景・下罫）は全幅のまま、中身だけ本文と同じ max-w-content に揃える。 */}
      <div className="mx-auto flex h-full w-full max-w-content items-center gap-3">
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {label}
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[9.5rem] justify-between">
              <span className="truncate">
                {current.label}
                {current.count !== undefined && (
                  <span className="ml-1.5 text-micro tabular-nums text-muted-foreground">
                    {current.count}
                  </span>
                )}
              </span>
              <ChevronDown data-icon="inline-end" />
            </Button>
          </PopoverTrigger>
          {/* 節は最大15個。2列に組めばどの幅でも一度に全部見える（縦スクロールも出ない）。 */}
          <PopoverContent align="start" className="grid w-[22rem] grid-cols-2 gap-0.5 p-1">
            {items.map((item) => {
              const active = item.id === current.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={active ? "true" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-baseline justify-between gap-2 rounded-sm px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-seal text-seal-foreground"
                      : "text-foreground/85 hover:bg-accent hover:text-seal",
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {item.count !== undefined && (
                    <span
                      className={cn(
                        "shrink-0 text-micro tabular-nums",
                        active ? "text-seal-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </a>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
