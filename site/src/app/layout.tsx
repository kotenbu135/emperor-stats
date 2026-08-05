import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

// 書体はサンセリフ1本（SITE_DESIGN.md「4. 配色と書体」— 見出しも本文も同じ）。
// 明朝は読み込むだけで一度も参照しておらず、@font-face 373件・約280KB（gz 98KB）の
// レンダーブロッキング CSS を1本まるごと増やしていたので落とした（Issue #79）。
//
// **2026-08-05 に `next/font/google` をやめ、自前サブセットに差し替えた。** 明朝を
// 落としたあとも同じ形の負債がサンセリフ側に残っていて（全 17,936 グリフの割り当て表＝
// @font-face 373件・283KB / gz 98KB がレンダーブロッキング）、PSI モバイルのパフォーマンスが
// 56、レンダリングブロックの推定削減が 9,090ms だった。実際に描く文字は 3,404 字しかない。
// 生成は tools/build-font-subset.py・宣言は src/app/fonts.css・weight は 400/500/700 で
// 変わっていない（700 は font-semibold(600) の解決先なので消さないこと。600 の実体が無く、
// CSS の重み照合が上方向に歩いて 700 に当たる）。`--font-sans` は globals.css が持つ。

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  robots: { index: true, follow: true },
  // Bing は public/BingSiteAuth.xml（サイト直下配信）で確認済み。Google は
  // DNS TXTレコードでの確認手続き中（未反映）のため、即時反映するmetaタグ方式も併用する。
  verification: { google: "Aabu8mRhf--Ct1Z9hHnypRFqL1PqHuIndBvoKSd32-k" },
  openGraph: {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {/* ふりがな（Issue #20）の初期状態を最初の描画前に当てる。既定は表示（ON）で、
            OFF を選んだ人だけ localStorage から復元する。`output: "export"` の
            静的書き出しなのでサーバー側では分岐できず、React のマウントを待つと
            ルビが出てから消えてちらつく。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('emperor-stats:ruby')==='off')document.documentElement.dataset.ruby='off'}catch(e){}`,
          }}
        />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
