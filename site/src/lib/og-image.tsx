// SNSシェア用OGP画像（next/og の ImageResponse）の共通レンダラ。
// opengraph-image.tsx群（サイト全体・統計8ページ・皇帝個別365件）から呼ばれる。
// フォントは assets/fonts/（ビルド専用。public/には置かず配信物を増やさない）の
// Noto Sans JP サブセット（このサイトの全皇帝名・王朝名・UI文言のみに絞ったグリフ）。

import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { dynastyContextLabel } from "@/components/emperors/emperor-detail-body";
import type { EmperorRecord } from "@/lib/emperor-types";
import { SITE_NAME } from "@/lib/seo";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

const fontsDir = path.join(process.cwd(), "assets", "fonts");
const regularFont = readFileSync(path.join(fontsDir, "NotoSansJP-Subset-Regular.ttf"));
const boldFont = readFileSync(path.join(fontsDir, "NotoSansJP-Subset-Bold.ttf"));

const OG_FONTS = [
  { name: "Noto Sans JP", data: regularFont, style: "normal" as const, weight: 400 as const },
  { name: "Noto Sans JP", data: boldFont, style: "normal" as const, weight: 700 as const },
];

const PALETTE = {
  background: "#f5f1e8",
  foreground: "#3a3530",
  muted: "#6b6258",
  seal: "#a6321c",
  sealForeground: "#f5f1e8",
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: PALETTE.background,
        padding: 56,
        fontFamily: "Noto Sans JP",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          border: `3px solid ${PALETTE.seal}`,
          borderRadius: 12,
          padding: 48,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto" }}>
      <div
        style={{
          display: "flex",
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: PALETTE.seal,
          color: PALETTE.sealForeground,
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        帝
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: PALETTE.foreground }}>
          {SITE_NAME}
        </span>
        <span style={{ fontSize: 16, color: PALETTE.muted }}>emperorstats.com</span>
      </div>
    </div>
  );
}

export async function renderEmperorOgImage(record: EmperorRecord): Promise<ImageResponse> {
  let portraitSrc: string | null = null;
  if (record.hasPortrait) {
    // next/ogのsatoriはwebpのデコードに難があり "u2 is not iterable" で落ちるため、
    // ビルド時にpngへ変換してから埋め込む（既存public/portraits/*.webpは変更しない）。
    const webpBuf = readFileSync(path.join(process.cwd(), "public", "portraits", `${record.id}.webp`));
    const pngBuf = await sharp(webpBuf).png().toBuffer();
    portraitSrc = `data:image/png;base64,${pngBuf.toString("base64")}`;
  }

  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: PALETTE.seal }}>
              {dynastyContextLabel(record)}
            </span>
            <span
              style={{
                fontSize: 88,
                fontWeight: 700,
                color: PALETTE.foreground,
                marginTop: 8,
                lineHeight: 1.15,
              }}
            >
              {record.name}
            </span>
            <span style={{ fontSize: 30, color: PALETTE.muted, marginTop: 24 }}>
              在位 {record.periodsLabel}（{record.reignDurationLabel}）
            </span>
          </div>
          {portraitSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- next/ogのImageResponseはnext/imageを使えない
            <img
              src={portraitSrc}
              alt=""
              width={220}
              height={293}
              style={{ borderRadius: 16, border: `4px solid ${PALETTE.seal}`, objectFit: "cover" }}
            />
          )}
        </div>
        <Footer />
      </Frame>
    ),
    { ...OG_IMAGE_SIZE, fonts: OG_FONTS },
  );
}

export function renderStatPageOgImage({
  title,
  description,
}: {
  title: string;
  description: string;
}): ImageResponse {
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: PALETTE.seal }}>{SITE_NAME}</span>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: PALETTE.foreground,
              marginTop: 16,
              lineHeight: 1.15,
            }}
          >
            {title}
          </span>
          <span
            style={{
              display: "flex",
              fontSize: 28,
              color: PALETTE.muted,
              marginTop: 24,
              lineHeight: 1.5,
              maxWidth: 900,
            }}
          >
            {description}
          </span>
        </div>
        <Footer />
      </Frame>
    ),
    { ...OG_IMAGE_SIZE, fonts: OG_FONTS },
  );
}
