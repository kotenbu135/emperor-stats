import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  contained = false,
}: {
  title: string;
  description?: string;
  /** 本文を中央寄せにする記事型ページ（/about等）で、見出しも本文と同じ列に揃える */
  contained?: boolean;
}) {
  return (
    <div className="border-b border-border bg-background px-6 py-8 md:px-10">
      <div className={cn(contained && "mx-auto w-full max-w-2xl")}>
        <div className="flex items-center gap-3">
          {/* 印章の朱をイメージしたアクセントバー（水墨基調に差す一点の色味） */}
          <span aria-hidden className="h-7 w-1 shrink-0 rounded-full bg-seal" />
          <h1 className="font-heading text-2xl font-semibold text-foreground md:text-3xl">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 px-6 py-8 md:px-10">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-seal/80" />
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {title}
        </h2>
      </div>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}
