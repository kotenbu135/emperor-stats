import Link from "next/link";

const REPO_URL = "https://github.com/kotenbu135/emperor-stats";

export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border bg-secondary/60 px-6 py-4 md:px-10">
      <div className="mx-auto max-w-2xl space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        <p>
          本サイトの数値は『史記』『明史』などの正史（本紀・列伝）を第一の典拠として1件ずつ原典を確認して集計しています。肖像画はパブリックドメインまたはCC0の画像のみ使用しています。
        </p>
        <p>
          <Link
            href="/about"
            className="underline underline-offset-2 hover:text-seal"
          >
            収録基準・データの数え方・出典の詳細
          </Link>
          <span aria-hidden className="mx-2">
            ／
          </span>
          データの誤りのご指摘・お問い合わせは
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-seal"
          >
            GitHubリポジトリ
          </a>
          へのPull Requestでお寄せください。
        </p>
      </div>
    </footer>
  );
}
