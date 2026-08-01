// 皇帝の表示名を決める唯一の場所（2026-08-02）。
//
// カード1行目・個別ページの h1・`<title>`・OGP・データベースの表・チャートの軸ラベルは
// すべてここを通す。**表示名の決定をここ以外に書かないこと** — かつては
// `emperors.ts` の `displayName()`、`card-subtitle.ts`、`emperors.ts:1881` の
// `${commonName}（${dynastyLabel}）` が別々に名前を組み立てていて、同じ人物が面ごとに
// 違う名前で出ていた。
//
// 設計と決定の記録は ../../docs/site-design/NAME_DISPLAY_PLAN_2026-08-02.md。
//
// ■ 1行目（通用名）
// データの `name.commonName` は「呼称・括弧・補足」の形で、括弧の中身が
// 諱36・元号帝29・爵位13・別諡号8・政権名7・並列2 と**6つの意味を兼ねていた**
// （表示では括弧が中黒になるので、画面上はさらに区別が付かない）。
// ここでは括弧を1つの意味に絞らず**解体**する。
//
//   R1/R3  括弧を落として呼称だけを1行目に出す（諱は補助スロットへ、
//          爵位・別諡号・別称は個別ページの名前ブロックへ）
//   R2     明・南明・清は括弧の中の元号＋帝を1行目に上げる（一世一元の制で
//          元号が在位と1対1になり、日本では廟号よりこちらが通用するため）
//
// ■ 補助名（諱）
// 非漢族の政権は民族名と漢名の両方を持ち、**データ上の並び順が政権ごとに逆**なので
// 政権単位の規則で「日本で通用する側」を選ぶ（遼＝括弧内の漢風名、金・元＝括弧前、
// 清＝「愛新覚羅」を落とした諱）。**括弧の汎用分解はしない** — 北漢の
// 「劉崇（劉旻）」は改名であって民族名ではない。

/** 明・南明・清。R2（元号＋帝を1行目に上げる）の対象。 */
const ERA_NAME_REGIMES = new Set(["ming", "southern-ming", "qing"]);

/**
 * 1行目の上書き（id → 表示名）。規則で決まらない15件と、
 * 慣行より知名度が勝つ例外（2026-08-02 ユーザー決定）。
 */
export const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  // 慣行（諡号）より通用が勝つ。データの commonName は諡号「高帝」。
  "han-gaozu": "高祖",
  // 「則天大聖皇帝（武則天）」→「武則天」だけにする（2026-08-02 ユーザー決定）。
  "tang-wuzetian": "武則天",
  // 元号が2つある人。R2 は括弧の中をそのまま採るのでスラッシュが残る。
  "ming-taizong": "永楽帝", // 太宗/成祖（永楽帝）
  "ming-yingzong": "正統帝", // 英宗（正統帝/天順帝）。復位後が天順
  // ホンタイジは元号が2つ（天聰・崇徳）あり、日本ではこの名で通っている。
  "qing-taizong": "ホンタイジ",
  // 自称の帝号と諱を連結した文字列。名前として通っているのは諱の側。
  // 「承天応運啓聖睿文宣武皇帝黄巣」は14字あり、カード1行目（全角13字前後）で切れていた。
  "tangmo-huangchao": "黄巣",
  "tangmo-anlushan": "安禄山",
  "tangmo-shisiming": "史思明",
  "wuzhou-wusangui": "昭武帝", // 太祖昭武帝（呉三桂）。諱は補助スロットへ
};

/**
 * 括弧を落とさず原文のまま出す id。
 *
 * 「侯景政権（正平）」型は**名前ではなく政権の説明**で、この文法から外れている。
 * ただし2行目の王朝ラベルは `regimeId` 由来の「梁（蕭梁）」なので、括弧を落として
 * 諱にすると**対立政権であることがどこにも出なくなる**。受け皿（王朝行かバッジ）を
 * 作るまで動かさない（NAME_DISPLAY_PLAN の「3-6. 手を付けないもの」）。
 */
const KEEP_RAW_NAME = new Set([
  "liang-xiaozhengde", // 侯景政権（正平）
  "liang-xiaoji", // 益州政権（天正）
  "liang-xiaoyuanming", // 北斉擁立政権（天成）
  "liang-xiaozhuang", // 北斉擁立政権（天啓）
]);

/**
 * カード1行目・h1 に出す通用名。
 * @param id 皇帝id
 * @param commonName データの `name.commonName`
 * @param regimeId データの `regimeId`（R2 の判定に使う）
 */
export function emperorDisplayName(
  id: string,
  commonName: string,
  regimeId: string,
): string {
  const override = DISPLAY_NAME_OVERRIDES[id];
  if (override) return override;
  if (KEEP_RAW_NAME.has(id)) return commonName;
  const inner = /（(.+?)）/.exec(commonName)?.[1];
  // R2: 明・南明・清の「廟号（元号＋帝）」は元号＋帝を主にする。
  if (inner && ERA_NAME_REGIMES.has(regimeId) && inner.endsWith("帝")) {
    return inner;
  }
  // R1・R3: 括弧は落とす。落とした中身の行き先は補助スロットと名前ブロック。
  return commonName.replace(/（.+?）/g, "");
}

/**
 * 補助名（諱）の人物別上書き。null は「補助名を出さない」。
 * 政権単位の規則（下の `emperorSubtitle`）で決まらないものだけを置く。
 */
export const SUBTITLE_OVERRIDES: Record<string, string | null> = {
  // 金太祖: データの諱は金史本紀の「讳旻，本讳阿骨打」にそろえて「完顔旻（阿骨打）」だが、
  // 日本で通っているのは女真名を姓に付けた「完顔阿骨打」（他の9人は漢名が通用名なので規則どおり）。
  "jin-taizu": "完顔阿骨打",
  // 「嬴胡亥」表記は一般的でなく「胡亥」が通用。
  "qin-er-shi": "胡亥",
};

/**
 * カード1行目・h1 で通用名の脇に小さく出す補助名（諱）。無い場合は null。
 *
 * 通用名が「武帝」「太宗」だけでは人物が特定できず、諱（劉徹・李世民）で
 * 検索されることも多いため出している。**通用名に諱が含まれているときは出さない**
 * （「王莽」「太祖 朱全忠」のような重複表示を避ける）。
 *
 * @param id 皇帝id
 * @param personalName 諱（データ原文。民族名の併記を含むことがある）
 * @param regimeId データの `regimeId`（民族名の並びが政権ごとに違う）
 * @param displayName 1行目（重複判定に使う）
 */
export function emperorSubtitle(
  id: string,
  personalName: string | null,
  regimeId: string,
  displayName: string,
): string | null {
  if (id in SUBTITLE_OVERRIDES) return SUBTITLE_OVERRIDES[id];
  if (!personalName) return null;
  const inner = /（(.+?)）/.exec(personalName)?.[1];
  // 遼だけが「契丹名（漢風名）」の並びで、通用するのは括弧の中の漢風名
  //（耶律堯骨ではなく耶律徳光）。太祖 耶律阿保機と西遼は括弧が無く、そのまま通る。
  // 金は「漢名（女真名）」、元は「原音カナ（漢字音写）」で括弧の前が通用名。
  let name = regimeId === "liao" && inner ? inner : personalName.split("（")[0];
  // 清の11人は「愛新覚羅」＋諱。姓を落として諱だけを出す。
  if (regimeId === "qing") name = name.replace(/^愛新覚羅/, "");
  if (!name || displayName.includes(name)) return null;
  return name;
}

/**
 * 曖昧さを解いた名前。**同じ王朝の中で通用名がぶつかる組にだけ諱を添える**
 * （南斉の廃帝3人＝蕭昭業・蕭昭文・蕭宝巻、後漢の少帝2人）。それ以外は通用名のまま。
 *
 * `<title>`・JSON-LD のように、王朝は別に添えるが名前そのものが一意である必要がある面で使う。
 */
export function disambiguatedEmperorName(
  displayName: string,
  subtitle: string | null,
  needsSubtitle: boolean,
): string {
  return needsSubtitle && subtitle ? `${displayName} ${subtitle}` : displayName;
}

/**
 * 王朝を冠した名前（「漢の武帝」）。**カードと表には使わない** — どちらも王朝が
 * 隣に出るので二重になる。チャートの軸ラベル・ツールチップのように、
 * **名前の文字列しか置けない面**のためのもの。
 *
 * 通用名は37種104人が重複していて、王朝を冠しても同じ王朝の中でぶつかる組があるため
 * `disambiguatedEmperorName` を通した名前に冠する。
 */
export function qualifiedEmperorName(
  disambiguatedName: string,
  dynastyLabel: string,
): string {
  return `${dynastyLabel}の${disambiguatedName}`;
}

/**
 * 民族名のラベル（政権 ID → その政権で括弧に入っている名前の種類）。
 *
 * **括弧の汎用分解はしないこと。** 同じ「◯◯（◯◯）」を政権ごとに別の意味で使っていて、
 * まとめて割るとクビライに「女真名」の行が生える。遼だけは並びが逆（契丹名（漢風名））
 * なので下の `emperorNameEntries` で個別に扱う。
 */
const ETHNIC_NAME_LABEL: Record<string, string> = {
  liao: "契丹名",
  "jin-jurchen": "女真名",
  yuan: "漢字音写", // クビライ（忽必烈）＝原音カナと漢字音写
  "northern-yuan": "漢字音写",
  qing: "満洲語名", // 愛新覚羅皇太極（ホンタイジ）
};

/** `personalName` の括弧が民族名ではなく改名を表す（北漢の劉崇＝のちの劉旻）。 */
const RENAMED_NAME_IDS = new Set(["shiguo-beihan-liuchong"]);

export interface EmperorNameEntry {
  label: string;
  value: string;
}

/**
 * 個別ページのヒーローに出す名前のチップ。諱・民族名・廟号・諡号・元号・別称・別名を
 * 種類のラベル付きで並べる。**1行目（h1）に出ている名前と同じ値は出さない**
 * （h1 の脇の補助名との重複は `emperor-hero.tsx` 側で落とす）。
 *
 * `commonName` の括弧から表示名で落とした情報の行き先がここ（「廃帝（昌邑王）」の
 * 昌邑王、「元帝（孝元帝）」の孝元帝、明清の廟号など）。
 *
 * `templeName` は70/365・`posthumousName` は98/365 しか埋まっていないので、
 * **多くの皇帝で諱の1行しか出ない**。データを足せば行が増える作りにしてある
 * （docs/site-design/NAME_DISPLAY_PLAN_2026-08-02.md の5節）。
 */
export function emperorNameEntries(r: {
  id: string;
  dynastyKey: string;
  name: string;
  commonName: string;
  personalName: string | null;
  templeName: string | null;
  posthumousName: string | null;
  aliases: string[];
}): EmperorNameEntry[] {
  const entries: EmperorNameEntry[] = [];
  const push = (label: string, value: string | null | undefined) => {
    const v = value?.trim();
    // 1行目に出ている名前・既に出した値は行にしない（同じ名前が2度並ぶのを防ぐ）。
    if (!v || v === r.name || entries.some((e) => e.value === v)) return;
    entries.push({ label, value: v });
  };

  // 諱と民族名。並びは政権ごとに違う（遼だけ「契丹名（漢風名）」で逆）。
  const personalInner = /（(.+?)）/.exec(r.personalName ?? "")?.[1] ?? null;
  const personalOuter = (r.personalName ?? "").split("（")[0];
  if (r.personalName && !personalInner) {
    push("諱", r.personalName);
  } else if (r.personalName && personalInner) {
    if (r.dynastyKey === "liao") {
      push("諱", personalInner); // 漢風名（耶律徳光）
      push("契丹名", personalOuter); // 耶律堯骨
    } else if (RENAMED_NAME_IDS.has(r.id)) {
      push("諱", personalOuter);
      push("別称", personalInner);
    } else {
      push("諱", personalOuter);
      push(ETHNIC_NAME_LABEL[r.dynastyKey] ?? "別称", personalInner);
    }
  }

  // 呼称（commonName）側。R2 で1行目に上げた元号＋帝の裏で落ちた廟号をここで拾う
  // （明清は templeName が空のことが多く、この経路でしか出せない）。
  const inner = /（(.+?)）/.exec(r.commonName)?.[1] ?? null;
  const outer = r.commonName.replace(/（.+?）/g, "");
  const isEraName =
    inner !== null && ERA_NAME_REGIMES.has(r.dynastyKey) && inner.endsWith("帝");
  push("廟号", r.templeName ?? (isEraName ? outer.replace("/", "・") : null));
  push("諡号", r.posthumousName);
  if (isEraName) {
    // 「正統帝/天順帝」→「正統・天順」。元号そのものを出すので「帝」は落とす。
    push("元号", inner.split("/").map((s) => s.replace(/帝$/, "")).join("・"));
  } else if (inner && !KEEP_RAW_NAME.has(r.id)) {
    for (const part of inner.split("、")) {
      // 諱の再掲（「少帝（懿）」）と注記（「泰定帝（通称）」）は行にしない。
      if (part === "通称" || (r.personalName ?? "").includes(part)) continue;
      push("別称", part);
    }
  }
  if (!isEraName && !KEEP_RAW_NAME.has(r.id)) {
    // 「承天応運啓聖睿文宣武皇帝黄巣」のように**自称の帝号に諱が連なっている**形は、
    // 帝号の部分だけを別称にする（諱は上の行に出ているので二重になる）。
    push("別称", r.name && outer.endsWith(r.name) ? outer.slice(0, -r.name.length) : outer);
  }
  for (const alias of r.aliases) push("別名", alias);
  return entries;
}

/**
 * 同じ種類の名前を1行にまとめる（「別名 秦始皇」「別名 趙政」→「別名 秦始皇・趙政」）。
 * 同じラベルが縦に2つ並ぶと表示の不具合に見えるため（該当は3人）。
 *
 * JSON-LD の `alternateName` は名前を1つずつ並べる必要があるので、まとめる前の
 * `emperorNameEntries` をそのまま使うこと。
 */
export function groupEmperorNameEntries(
  entries: EmperorNameEntry[],
): { label: string; values: string[] }[] {
  const groups: { label: string; values: string[] }[] = [];
  for (const entry of entries) {
    const group = groups.find((g) => g.label === entry.label);
    if (group) group.values.push(entry.value);
    else groups.push({ label: entry.label, values: [entry.value] });
  }
  return groups;
}

/**
 * 冠称形が365人で一意であることを保証する。重複したら id を並べて throw する
 * （`DYNASTY_COLOR_SLOT`・`kana-readings` と同じ、黙って壊れないための検出器）。
 *
 * データ側に諡号・廟号を足していくと（NAME_DISPLAY_PLAN の5節）新しい重複が
 * 生まれうるので、規則ではなくビルド時の検査で守る。
 *
 * @returns 諱を添えないと区別できない id の集合
 */
export function resolveQualifiedNameCollisions(
  entries: { id: string; displayName: string; dynastyLabel: string; subtitle: string | null }[],
): Set<string> {
  const byKey = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = `${e.dynastyLabel}の${e.displayName}`;
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }
  const needsSubtitle = new Set<string>();
  const unresolved: string[] = [];
  for (const [key, group] of byKey) {
    if (group.length === 1) continue;
    for (const e of group) needsSubtitle.add(e.id);
    // 諱を添えても同じになる（＝諱が無い・同名）ものは検出して止める。
    const withSubtitle = new Set(group.map((e) => `${key} ${e.subtitle ?? ""}`));
    if (withSubtitle.size < group.length) {
      unresolved.push(`"${key}" ← ${group.map((e) => e.id).join(", ")}`);
    }
  }
  if (unresolved.length > 0) {
    throw new Error(
      `王朝を冠しても区別できない皇帝名があります: ${unresolved.join(" / ")}` +
        `（display-name.ts の DISPLAY_NAME_OVERRIDES で1行目を分けてください）`,
    );
  }
  return needsSubtitle;
}
