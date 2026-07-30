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
import { getEmperorOgChips, type OgFact } from "@/lib/emperors";
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
  /** 事実カード・チップの罫と面（本文の --border / --card 相当の値を焼き込んだもの）。 */
  line: "#d9d1c2",
  card: "#fbf8f2",
};

/** 事実カード（ページの代表的な数値）。2枚を横に並べる前提の幅で組む。 */
function FactCards({ facts }: { facts: OgFact[] }) {
  if (facts.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 20, marginTop: 26 }}>
      {facts.map((f) => (
        <div
          key={f.label}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            border: `1px solid ${PALETTE.line}`,
            borderLeft: `6px solid ${PALETTE.seal}`,
            borderRadius: 10,
            padding: "14px 18px",
            backgroundColor: PALETTE.card,
          }}
        >
          <span style={{ fontSize: 18, color: PALETTE.muted }}>{f.label}</span>
          <span
            style={{
              fontSize: 34,
              fontWeight: 700,
              color: PALETTE.foreground,
              marginTop: 4,
            }}
          >
            {f.value}
          </span>
          {f.sub && (
            <span style={{ fontSize: 18, color: PALETTE.muted, marginTop: 2 }}>
              {f.sub}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

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

/** 内側の幅992pxから、肖像（220px）とその左の余白（48px）を引いた左カラムの実効幅。 */
function emperorColumnWidth(hasPortrait: boolean): number {
  return hasPortrait ? 992 - 220 - 48 : 992;
}

/** 文字列の幅を em 単位で見積もる（全角＝1em・ASCII＝0.55em）。
 *  皇帝名は全角だけとは限らず（「英宗・正統帝/天順帝」）、在位行は数字と区切りが大半。 */
function approxEmWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += /[\x20-\x7e]/.test(ch) ? 0.55 : 1;
  return w;
}

/**
 * 1行に収まる文字サイズを幅から逆算する。折り返すと下の要素（チップ・フッター）と
 * 重なるため、長い文字列は縮めて1行に保つ。
 * 実測で踏んだ2件: 皇帝名は2文字（「太宗」）〜14文字（「承天応運啓聖睿文宣武皇帝黄巣」）、
 * 在位行は復位者（宣統帝「在位 1908–1912年 / 1917年 / 1934–1945年（14年256日）」）が最長。
 */
function fitFontSize(text: string, available: number, max: number, min: number): number {
  const fit = Math.floor((available * 0.98) / Math.max(approxEmWidth(text), 1));
  return Math.max(min, Math.min(max, fit));
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

  const columnWidth = emperorColumnWidth(portraitSrc !== null);
  const reignLine = `在位 ${record.periodsLabel}（${record.reignDurationLabel}）`;

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
                fontSize: fitFontSize(record.name, columnWidth, 88, 44),
                fontWeight: 700,
                color: PALETTE.foreground,
                marginTop: 8,
                lineHeight: 1.15,
              }}
            >
              {record.name}
            </span>
            <span
              style={{
                fontSize: fitFontSize(reignLine, columnWidth, 30, 20),
                color: PALETTE.muted,
                marginTop: 18,
              }}
            >
              {reignLine}
            </span>
            {/* 名前と在位だけでは「開くと何が分かるか」が伝わらないため、
                個別ページが持っている順位・分類をチップで見せる（2026-07-27）。 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
              {getEmperorOgChips(record).map((chip) => (
                <span
                  key={chip}
                  style={{
                    display: "flex",
                    fontSize: 20,
                    color: PALETTE.foreground,
                    border: `1px solid ${PALETTE.line}`,
                    borderRadius: 999,
                    padding: "8px 18px",
                    backgroundColor: PALETTE.card,
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
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

/** 統計ページの共有カード画像。
 *  ここに渡す title は**ページの `<title>` ではなくナビの短いラベル**を使う（2026-07-27）。
 *  検索向けに `<title>` を具体化した（例「在位年数ランキングと復位者一覧」）が、大きな文字で
 *  15文字を超えると内側の幅992pxで折り返し、下の要素と重なる。カード画像は一目で読める板として
 *  短い名前を出し、検索クエリと重ねる長い文字列は og:title（＝metadata 側）が運ぶ。
 *
 *  facts は各ページの代表的な数値（lib/emperors.ts の getOgFacts）。ページ名と説明だけでは
 *  「開くと何が分かるか」が画像から読めずクリックに繋がらないため、実データを2枚のカードで
 *  見せる（2026-07-27 の SEO 監査 2-5）。縦の内訳は 24+74+38+26+110+40 で内側の高さ416pxに収まる。 */
export function renderStatPageOgImage({
  title,
  description,
  facts = [],
}: {
  title: string;
  description: string;
  facts?: OgFact[];
}): ImageResponse {
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: PALETTE.seal }}>{SITE_NAME}</span>
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: PALETTE.foreground,
              marginTop: 6,
              lineHeight: 1.15,
            }}
          >
            {title}
          </span>
          <span
            style={{
              display: "flex",
              fontSize: 26,
              color: PALETTE.muted,
              marginTop: 14,
              lineHeight: 1.45,
              maxWidth: 940,
            }}
          >
            {description}
          </span>
          <FactCards facts={facts} />
        </div>
        <Footer />
      </Frame>
    ),
    { ...OG_IMAGE_SIZE, fonts: OG_FONTS },
  );
}
