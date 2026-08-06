"use client";

// ふりがなの表示切り替え（GitHub Issue #20）。
// 方針は docs/site-design/RUBY_PLAN_2026-08-01.md、記法とパーサは lib/ruby.ts。
//
// **既定は表示（ON）。** 読めない漢字で止まる人が来る前提の機能なので、既定で
// 消えていると見つけてもらえない。
//
// 切り替えは <html data-ruby="off"> を立てるだけで、rt の DOM は動かさない
// （実行時に要素を足し引きすると行の高さが変わってレイアウトシフトになる）。
// 初期値は layout.tsx のインラインスクリプトが最初の描画前に当てる。

import { useId, useSyncExternalStore } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const RUBY_STORAGE_KEY = "emperor-stats:ruby";

// 状態の持ち主は React ではなく <html data-ruby>（インラインスクリプトが最初の描画前に
// 当て、CSS がそれを見て rt を消す）。ボタンのラベルはその外部状態を読むだけなので、
// state を二重に持たず useSyncExternalStore で同期する。
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function isRubyOn(): boolean {
  return document.documentElement.dataset.ruby !== "off";
}

export function RubyToggle({
  className,
  variant = "block",
}: {
  className?: string;
  /**
   * `block` = ラベル付きの行（サイドバー最下部）。
   * `compact` = 36px の四角ひとつ（モバイルヘッダー・2026-08-06）。
   * **状態の持ち主は同じ**（下の toggle と <html data-ruby>）で、見た目だけが違う。
   */
  variant?: "block" | "compact";
}) {
  // SSR とハイドレーション直後は既定の ON で描く。OFF を選んでいる人はこのボタンの
  // ラベルだけが一瞬 ON になる（ルビ自体はインラインスクリプトが先に消している）。
  const on = useSyncExternalStore(subscribe, isRubyOn, () => true);
  const id = useId();

  function toggle(next: boolean) {
    document.documentElement.dataset.ruby = next ? "on" : "off";
    for (const listener of listeners) listener();
    try {
      window.localStorage.setItem(RUBY_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // プライベートモード等で保存できなくても、そのセッションの表示は切り替わる。
    }
  }

  if (variant === "compact") {
    return (
      // モバイルヘッダーはナビの3項目でほぼ埋まるため、ラベルと Switch の並びは
      // 入らない。押すと何が起きるかは見た目そのもの（ふりがなの付いた「字」）で
      // 示し、読み上げには aria-label と role="switch" の状態で伝える。
      // ルビが消えても字が動かないよう、下端で揃えて上へ伸ばす（items-end）。
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="ふりがな"
        onClick={() => toggle(!on)}
        className={cn(
          "flex size-9 shrink-0 items-end justify-center rounded-md border border-border pb-2.5 text-sm leading-none transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-seal",
          // 選択中（＝ふりがな表示）は朱。非選択を hover 後の見た目にしない。
          on ? "text-seal" : "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <ruby>
          字<rt>じ</rt>
        </ruby>
      </button>
    );
  }

  return (
    // 2026-08-01: 自前の aria-pressed ボタンから shadcn の Switch へ。
    // これは「押して実行する」操作ではなく表示の設定なので、role="switch" の
    // 部品に載せる（読み上げは「オン／オフ」で伝わり、ラベルは Label が結ぶ）。
    // 面全体を押せる形は保つ — サイドバー最下部の細い行で、つまみだけを
    // 狙わせると外しやすい。
    <div
      className={cn(
        "group/ruby flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors has-[:focus-visible]:border-ring hover:bg-accent",
        className,
      )}
    >
      <Label
        htmlFor={id}
        className="flex-1 text-xs font-normal text-muted-foreground transition-colors group-hover/ruby:text-foreground"
      >
        ふりがな
        {/* ラベル自身にルビを振って、何が起きるのかを見た目で示す。 */}
        <ruby className="ml-1 text-foreground">
          漢字
          <rt>かんじ</rt>
        </ruby>
      </Label>
      <Switch id={id} checked={on} onCheckedChange={toggle} />
    </div>
  );
}
