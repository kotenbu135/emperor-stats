import Link from "next/link";

const REPO_ISSUES_URL = "https://github.com/kotenbu135/emperor-stats/issues";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-secondary/60 px-6 py-3 md:px-10">
      {/* ワイド画面では1行に収まるよう、短い句をflex-wrapで並べる */}
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs leading-relaxed text-muted-foreground">
        <span>数値は正史（本紀・列伝）を1件ずつ原典確認して集計</span>
        <span aria-hidden>・</span>
        <span>肖像画はパブリックドメイン／CC0のみ使用</span>
        <span aria-hidden>・</span>
        <Link
          href="/about"
          className="underline underline-offset-2 hover:text-seal"
        >
          収録基準・数え方・出典の詳細
        </Link>
        <span aria-hidden>・</span>
        <span>
          誤りのご指摘・お問い合わせは
          <a
            href={REPO_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-seal"
          >
            GitHubのIssue
          </a>
          へ
        </span>
      </p>
    </footer>
  );
}
