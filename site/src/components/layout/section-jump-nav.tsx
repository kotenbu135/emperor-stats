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
// **2026-08-04 に `trailing` を足した**（ユーザー指示）。/emperors はこの帯に
// 絞り込み一式（検索・王朝・区分・件数）も載せる — 本文先頭に置いていた頃は、
// 少し送ると条件を変える手段が画面から消えていた。**帯は1行48pxのまま**なので、
// 渡す側が幅に応じて畳む（`trailing` の JSDoc と SITE_DESIGN.md の
// 「絞り込みは帯の中へ移した」節）。
//
// 【観測対象の注意】id は「節の本体」に付けること。見出しに付けると、見出しが
// sticky でこのバーの真下に貼り付き続けるかぎり判定帯（画面の20%〜45%）に
// 一度も入らず、現在地が永久に更新されない。

import { useEffect, useState, type ReactNode } from "react";
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
  ariaLabel,
  className,
  innerWidth = "max-w-content",
  popoverColumns = 2,
  trailing,
}: {
  items: JumpItem[];
  /** バー左端の見出し（例: "時代へジャンプ"）。狭い画面では出さない。 */
  label: string;
  /** nav のアクセシブルネーム。`trailing` に絞り込みを載せる面では帯の役目が
   *  「ジャンプ」だけではなくなるので、そのページの言い方を渡す。 */
  ariaLabel?: string;
  /**
   * ジャンプの右に並べる操作（/emperors の絞り込み一式）。**帯は1行48pxで固定**
   * （`SECTION_NAV_H` が節見出しの sticky top と節の scrollMarginTop を兼ねるため、
   * 折り返して2行になると15個の見出しと全ジャンプ先が黙ってずれる）。渡す側は
   * 折り返さない形（`whitespace-nowrap` と、縮む側の `min-w-0`）で組むこと。
   * 幅の分岐は**ビューポートではなくこの帯の内幅**で決める（md 以上はサイドバー
   * 240px のぶん実効幅が狭く、768px の画面で内幅は448pxしかない）ため、
   * 中身は `@container/bar` の container query 変種（`@xl/bar:` など）で書く。
   * **ポップオーバーの中身はポータルで帯の外へ出る**ので `/bar` の変種は効かない。
   */
  trailing?: ReactNode;
  /** バーの中身を揃える列幅クラス。**そのページの本文列と必ず同じ値にする** —
   *  既定のデータページ幅（max-w-content = 1200px）のまま記事型ページ（/about・
   *  読み物幅）に置くと、トリガーだけが本文より左に飛び出す。 */
  innerWidth?: string;
  /** ポップオーバーの列数。既定の2列は節が10個以上あるとき（/emperors の15時代）に
   *  縦スクロールを出さないための形で、目次として上から順に読ませたい場面
   *  （/about の9節）では1列のほうが追いやすい。 */
  popoverColumns?: 1 | 2;
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

  // 節が無くても trailing（絞り込み）があるときは帯を残す。/emperors は 0 件に
  // なると節も 0 個になるが、そこで帯ごと消すと絞り込みを外す手段が画面から
  // 消える（NoResults の「すべて解除」しか残らない）。
  if (items.length === 0 && !trailing) return null;

  // 現在地が未確定（読み込み直後・observer の初回通知前）は先頭の節を出す。
  // 空文字のまま出すとトリガーの幅がゼロ幅から実幅へ跳ねて CLS になる。
  // **items が空のときは undefined になる**ので、下のジャンプ部分ごと出さない。
  const current = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <nav
      aria-label={ariaLabel ?? label}
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
      {/* 帯（背景・下罫）は全幅のまま、中身だけ本文と同じ max-w-content に揃える。
          container query の基準はこの内側の箱にする（nav は全幅＋左右 gutter で、
          そちらを基準にすると内幅と最大80pxずれて分岐が狂う）。 */}
      <div className={cn("@container/bar mx-auto h-full w-full", innerWidth)}>
        <div className="flex h-full items-center gap-2 @xl/bar:gap-3">
          {/* 見出しは帯に収まるときだけ出す。絞り込みを載せる面では帯がいちばん
              広いときに限る（出したままにすると右端の件数が押し出される）。 */}
          <span
            className={cn(
              "hidden shrink-0 text-xs text-muted-foreground",
              trailing ? "@5xl/bar:inline" : "@md/bar:inline",
            )}
          >
            {label}
          </span>
          {current && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  // 帯に並ぶ他の操作（検索窓・セレクト）が h-8 なので高さを揃える。
                  // **幅に下限を置く** — 右に絞り込みが載る面では、条件が効いた
                  // 瞬間に右側が太り（件数が「42/365名」になり印が付く）、縮み代を
                  // 全部かぶるここが2文字まで潰れる（下限が無いと実測68px）。
                  className="min-w-[6.5rem] shrink justify-between @xl/bar:min-w-[9.5rem]"
                >
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
              <PopoverContent
                align="start"
                className={cn(
                  "grid gap-0.5 p-1",
                  popoverColumns === 2 ? "w-[22rem] grid-cols-2" : "w-[13rem] grid-cols-1",
                )}
              >
                {items.map((item) => {
                  const active = item.id === current.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      aria-current={active ? "true" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-baseline justify-between gap-2 rounded-sm px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal",
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
          )}
          {trailing && (
            // 絞り込みは右詰め。縮む側（検索窓）が min-w-0 を効かせられるよう、
            // この箱自体も min-w-0 で受ける。
            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
              {trailing}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
