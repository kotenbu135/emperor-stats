"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { navCategories } from "@/lib/nav-data";

function sectionIdsFor(pathname: string): string[] {
  return navCategories
    .flatMap((c) => c.items ?? [])
    .filter((item) => item.href.split("#")[0] === pathname)
    .map((item) => item.href.split("#")[1])
    .filter((h): h is string => !!h);
}

/** 現在のページが属するカテゴリ（サブ項目を持つもの）のラベル。 */
function categoryLabelFor(pathname: string): string | null {
  return (
    navCategories.find((c) => c.items && c.href === pathname)?.label ?? null
  );
}

/**
 * 現在表示中のセクションid（IntersectionObserverによるスクロール連動）。
 * 同一ページ内に複数のアンカーリンクがあるとき、見ているセクションだけを強調する。
 * 観測結果が出るまで（および該当セクションがないページでは）先頭セクションを既定にする。
 */
function useActiveSection(pathname: string): string | null {
  // pathnameとペアで持ち、ページ遷移直後に前ページの観測結果を引きずらないようにする。
  const [observed, setObserved] = useState<{ path: string; id: string } | null>(
    null,
  );

  useEffect(() => {
    const ids = sectionIdsFor(pathname);
    if (ids.length === 0) return;

    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) setObserved({ path: pathname, id: hash });
    };
    window.addEventListener("hashchange", onHashChange);

    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setObserved({ path: pathname, id: visible[0].target.id });
        }
      },
      // 画面上部20%〜下部55%の帯に入ったセクションを「表示中」とみなす。
      { rootMargin: "-20% 0px -55% 0px" },
    );
    for (const el of sections) observer.observe(el);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      observer.disconnect();
    };
  }, [pathname]);

  if (observed && observed.path === pathname) return observed.id;
  return sectionIdsFor(pathname)[0] ?? null;
}

function NavAnchor({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active?: boolean;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block py-1.5 text-sm text-foreground/80 transition-colors hover:text-seal",
        active && "font-medium text-seal",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * メニューの挙動:
 * - カテゴリはデフォルトで閉じ、現在表示中のページのカテゴリだけ自動で開く
 * - カテゴリ見出し自体もリンク（配下ページの先頭へ遷移）。開閉は右端のシェブロンで行う
 * - ユーザーが手で開いたカテゴリはページ遷移後も開いたままにする
 */
export function NavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeId = useActiveSection(pathname);

  // 開閉状態は「最後に手で操作したときのpathname＋開いていたカテゴリ」を保持し、
  // 表示時に導出する。別ページへ遷移した直後は、手動の開閉を引き継ぎつつ
  // 現在ページのカテゴリを必ず開いた状態に加える（effect不要のderived state）。
  const [toggled, setToggled] = useState<{
    path: string;
    values: string[];
  } | null>(null);
  const currentCategory = categoryLabelFor(pathname);
  const openValues =
    toggled?.path === pathname
      ? toggled.values
      : currentCategory
        ? [...new Set([...(toggled?.values ?? []), currentCategory])]
        : (toggled?.values ?? []);
  const setOpenValues = (values: string[]) =>
    setToggled({ path: pathname, values });

  return (
    <nav>
      <Accordion
        type="multiple"
        value={openValues}
        onValueChange={setOpenValues}
        className="gap-1"
      >
        {navCategories.map((category) =>
          category.items ? (
            <AccordionItem
              key={category.label}
              value={category.label}
              className="border-none"
            >
              <div className="flex items-center">
                <Link
                  href={category.href}
                  onClick={onNavigate}
                  aria-current={pathname === category.href ? "page" : undefined}
                  className={cn(
                    "flex-1 py-2 font-heading text-sm font-semibold text-foreground transition-colors hover:text-seal",
                    pathname === category.href && "text-seal",
                  )}
                >
                  {category.label}
                </Link>
                <AccordionTrigger
                  aria-label={`${category.label}の項目を開閉`}
                  className="flex-none rounded-md p-1.5 hover:bg-accent/70 hover:no-underline"
                />
              </div>
              {/* shadcn既定の [&_a]:underline を打ち消す（ナビは下線なしで色のみで示す） */}
              <AccordionContent className="[&_a]:no-underline [&_a]:hover:text-seal">
                <div className="flex flex-col border-l border-border pl-3">
                  {category.items.map((item) => {
                    const [itemPath, itemHash] = item.href.split("#");
                    const active =
                      pathname === itemPath &&
                      (!itemHash || activeId === itemHash);
                    return (
                      <NavAnchor
                        key={item.label}
                        href={item.href}
                        active={active}
                        onNavigate={onNavigate}
                      >
                        {item.label}
                      </NavAnchor>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : (
            <div key={category.label} className="py-1">
              <NavAnchor
                href={category.href}
                active={pathname === category.href}
                onNavigate={onNavigate}
              >
                <span className="font-heading text-sm font-semibold">
                  {category.label}
                </span>
              </NavAnchor>
            </div>
          ),
        )}
      </Accordion>
    </nav>
  );
}
