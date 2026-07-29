// 皇帝1人分のフルEmperorRecord（ranks・videos込み）をJSONで返すRoute Handler。
// output: "export"では全idがビルド時に out/emperor-records/{id} の静的ファイルへ
// 書き出される（拡張子なし。fetch側はres.json()で読むためContent-Type不問）。
// /emperors一覧のRSCペイロードには軽量なEmperorListRecordだけを載せ、詳細ダイアログを
// 開いた時にここをfetchする（経緯noteのpublic/emperor-notes/{id}.jsonと同じ方式）。

import { getAllEmperorRecords } from "@/lib/emperors";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams(): { id: string }[] {
  return getAllEmperorRecords().map((r) => ({ id: r.id }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const record = getAllEmperorRecords().find((r) => r.id === id)!;
  return Response.json(record);
}
