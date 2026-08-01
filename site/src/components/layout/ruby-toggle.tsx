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

import { useSyncExternalStore } from "react";
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

export function RubyToggle({ className }: { className?: string }) {
  // SSR とハイドレーション直後は既定の ON で描く。OFF を選んでいる人はこのボタンの
  // ラベルだけが一瞬 ON になる（ルビ自体はインラインスクリプトが先に消している）。
  const on = useSyncExternalStore(subscribe, isRubyOn, () => true);

  function toggle() {
    const next = !on;
    document.documentElement.dataset.ruby = next ? "on" : "off";
    for (const listener of listeners) listener();
    try {
      window.localStorage.setItem(RUBY_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // プライベートモード等で保存できなくても、そのセッションの表示は切り替わる。
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <span>
        ふりがな
        {/* ラベル自身にルビを振って、何が起きるボタンなのかを見た目で示す。 */}
        <ruby className="ml-1 text-foreground">
          漢字
          <rt>かんじ</rt>
        </ruby>
      </span>
      <span
        aria-hidden
        className={cn(
          "rounded-sm px-1.5 py-0.5 text-micro font-medium",
          on
            ? "bg-seal text-seal-foreground"
            : "border border-border text-muted-foreground",
        )}
      >
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}
