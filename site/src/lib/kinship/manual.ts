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

/** 線が箱に取り付く位置。side=辺、t=その辺上の位置(0〜1)。 */
export interface ManualAnchor {
  side: "L" | "R" | "T" | "B";
  t: number;
}

/** 補助線・遠祖主張の点線の付け根と、途中の折れ位置。 */
export interface ManualEdgeRoute {
  from?: ManualAnchor;
  to?: ManualAnchor;
  /** 折れ線の中間座標(左右に出る線ならx、上下に出る線ならy)。 */
  mid?: number;
  /**
   * 直交の折れ線をやめ、付け根どうしを1本の直線で結ぶ(2026-07-27)。
   * 斜めに離れたバンド間の交代矢印は、直角に曲げると遠回りして他のカプセルを
   * 横切るため(ユーザー要望)。true のときは mid を使わない。
   */
  straight?: boolean;
}

export interface ManualChapter {
  mode: "auto" | "manual";
  nodes: Record<string, ManualNodePos>;
  /** 見出し・ラベルの位置。キーは `band:<label>` / `dyn:<dynastyKey>` / `arrow:<key>` / `aux:<key>`。 */
  labels?: Record<string, ManualLabelPos>;
  /** 補助線の付け根。キーは補助線のkey(`k:…` / `m:…` / `c:…`)。 */
  edges?: Record<string, ManualEdgeRoute>;
  /** 垂下線が親から降りる位置(x)。キーは `<父id>|<母id or 空>`。 */
  junctions?: Record<string, number>;
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
