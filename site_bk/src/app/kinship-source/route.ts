// 系譜図の編集モード(?edit=1・開発時のみ)がレイアウトを再計算するための入力データ。
// ドラッグ中にブラウザ側で buildKinshipLayout を回して線・違反を即時更新するため、
// ビルド時と同じ入力(章スコープの皇帝・人物・エッジ)をそのまま配信する。
//
// 本番の静的書き出しでは空を返す(編集モードは開発時のみのため。約数百KBの
// 無駄な配信を避ける)。開発サーバでは常に実データを返す。

import { getKinshipSource } from "@/lib/emperors";

export const dynamic = "force-static";

export function GET(): Response {
  const editorEnabled = process.env.NODE_ENV !== "production";
  return Response.json(editorEnabled ? getKinshipSource() : {});
}
