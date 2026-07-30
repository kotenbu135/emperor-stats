import { getAllEmperorRecords } from "@/lib/emperors";
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE, renderEmperorOgImage } from "@/lib/og-image";

export const dynamic = "force-static";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
export const alt = "皇帝の在位期間・王朝・出典情報を記した紹介カード";

// page.tsxと同じく365件を明示的に列挙する（output: "export"では
// generateStaticParamsが無いとビルドできない。継承には頼らない）。
export function generateStaticParams(): { id: string }[] {
  return getAllEmperorRecords().map((r) => ({ id: r.id }));
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = getAllEmperorRecords().find((r) => r.id === id)!;
  return await renderEmperorOgImage(record);
}
