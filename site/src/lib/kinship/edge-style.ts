// 系譜図の線の見た目。**"use client" を付けないこと**（Issue #204）。
//
// この表は図（chapter-flow.tsx・client）と凡例（chapter-page.tsx・Server Component）の
// 両方が読む。以前は chapter-flow が export していたが、Server Component が
// "use client" モジュールの export を import すると **client reference（中身の無い
// 参照オブジェクト）**になり、`...EDGE_STYLE.mother` のスプレッドが何も写さず、
// 凡例の見本が全章で同じ実線・同色に落ちていた（tsc・lint・build はどれも落ちない。
// 受け入れ確認は out/kinship*.html の凡例ブロック内 <line> に stroke-dasharray と
// --kinship-succession が出ること）。

/** 線の種別。chapter-flow の KinshipEdge["kind"] はこれを使う（逆向きに import しない）。 */
export type KinshipEdgeKind =
  | "marriage"
  | "father"
  | "mother"
  | "child"
  | "adoptive"
  | "second"
  | "disputed"
  | "remote"
  | "succession";

/**
 * 線の見た目。**種別ごとに1箇所**で、図（chapter-flow）と凡例（chapter-page）が
 * 対で動く。
 *
 * 破線の刻みは**互いに倍以上**離す（2026-08-18 の外部レビュー: 実母の「3 3」と養親の
 * 「6 3」がぱっと見で区別できない）。いまは 実線 / 中破線 / 長破線 / 点 の4段。
 */
export const EDGE_STYLE: Record<KinshipEdgeKind, { dash?: string; color?: string; width?: number }> = {
  marriage: {},
  father: {},
  mother: { dash: "5 4" },
  child: {},
  // 一点鎖線。**実母の「5 4」と刻みの長さで区別しない** — 2026-08-18 の外部レビューで
  // 「長さ違いの破線は判別できない」と言われたので、形そのものを変えている。
  adoptive: { dash: "12 4 2 4" },
  // 遠祖（実父が史料に無い人の、祖父などへの線）。**養親と同じ一点鎖線を使う** —
  // どちらも「実の父子ではない特別な線」で、必ず線上に続柄のラベル（養父／祖父）が
  // 載るのでラベルで見分ける。刻み違いの破線を増やしても判別できない
  // （2026-08-18 の外部レビュー）。
  remote: { dash: "12 4 2 4" },
  second: { dash: "1 4", width: 2 },
  disputed: { dash: "1 4", width: 2 },
  succession: { dash: "6 4", color: "var(--kinship-succession)" },
};
