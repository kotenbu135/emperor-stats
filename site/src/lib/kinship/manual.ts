// 系譜図(/kinship)の手動レイアウト。章ごとに「自動配置」か「手動配置」かを切り替え、
// 手動配置の章は manual-layout.json の座標をそのまま使う(自動レイアウトの結果で
// 上書きされない = 凍結)。座標はブラウザの編集モード(?edit=1・開発時のみ)で
// ドラッグして作り、scripts/kinship-editor-server.mjs 経由でこのJSONへ保存する。
//
// 座標系:
// - x は章内の絶対px(SVG左端から)。
// - y は「年」で持つ(px ではない)。人物を足して時間軸が伸びても意味が保たれるため。
//   皇帝カプセルは高さ=在位期間なので y は指定できない(常に年目盛りから計算する)。
// - 表に無いノードは自動配置にフォールバックする(データ追加時の取りこぼし防止。
//   編集モードでは「未配置」として色を変えて示す)。

import raw from "./manual-layout.json";

export interface ManualNodePos {
  /** 章内の絶対x(px)。ノードの左辺。 */
  x?: number;
  /** 配置年(非皇帝のみ)。ピルの上下中央がこの年に来る。 */
  year?: number;
}

export interface ManualLabelPos {
  x: number;
  y: number;
}

export interface ManualChapter {
  mode: "auto" | "manual";
  nodes: Record<string, ManualNodePos>;
  /** 見出し・ラベルの位置。キーは `band:<label>` / `dyn:<dynastyKey>` / `arrow:<key>` / `aux:<key>`。 */
  labels?: Record<string, ManualLabelPos>;
}

export type ManualLayout = Record<string, ManualChapter>;

export const MANUAL_LAYOUT: ManualLayout = raw as ManualLayout;

export function manualChapterOf(
  manual: ManualLayout | undefined,
  chapterId: string,
): ManualChapter | undefined {
  const c = (manual ?? MANUAL_LAYOUT)[chapterId];
  return c && c.mode === "manual" ? c : undefined;
}
