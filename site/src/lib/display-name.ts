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
// 非漢族の政権は民族名と漢名の両方を持つ。**2026-08-03（Issue #37 単位3）に
// データ側が `name.ethnicName` へ分けた**ので、ここで括弧を割る必要はなくなった
// （分ける前は「◯◯（◯◯）」の並びが政権ごとに逆で、割り方を政権で分岐していた）。
// 残るのは「どちらを補助名に出すか」の編集判断だけで、下の `ETHNIC_SUBTITLE_KINDS`。

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

// かつてここに `KEEP_RAW_NAME`（梁の4件）があった。「侯景政権（正平）」型の
// commonName は名前ではなく政権の説明で、括弧を落とすと対立政権であることが
// どこにも出なくなるため表示規則の例外にしていた。**2026-08-02（Issue #35）に
// データ側を人物名基準（「蕭正徳（臨賀王）」）へ直したので例外は不要**になり、
// 爵位は R3 で落ちて個別ページの「別称」チップに出る。

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
  // 金太祖: データの諱は「完顔旻（阿骨打）」（金史本紀は「讳旻，本讳阿骨打」で姓を連ねないが、
  // 同じ金の他8人〈完顔晟…完顔守緒〉と姓＋諱で揃える表記方針・2026-08-03 ユーザー決定）。
  // 日本で通っているのは女真名を姓に付けた「完顔阿骨打」（他の9人は漢名が通用名なので規則どおり）。
  "jin-taizu": "完顔阿骨打",
  // 遼太祖: 遼史は「姓耶律氏，讳亿，字阿保机，小字啜里只」で、阿保機は**字**（契丹名の
  // 枠＝小字は啜里只）。民族名の欄では受けられないのでデータ側は諱 耶律億 ＋ 別名
  // 耶律阿保機だが、通用するのは阿保機のほう。
  "liao-taizu": "耶律阿保機",
  // 「嬴胡亥」表記は一般的でなく「胡亥」が通用。
  "qin-er-shi": "胡亥",
};

/**
 * 補助名に**民族名のほうを出す** kind（`meta.catalogs.ethnicNameKinds` の id）。
 *
 * 日本でどちらが通用するかの編集判断で、データからは決まらない
 * （遼＝漢風名の耶律徳光・金＝漢名の完顔雍・清＝諱の皇太極が通用し、
 * **元だけカナのクビライ**が通用する）。分ける前は「括弧の前を採る／遼だけ中」で
 * 同じ結果を出していたので、**移行の前後で画面は変わらない**。
 */
const ETHNIC_SUBTITLE_KINDS = new Set(["mongol"]);

/**
 * カード1行目・h1 で通用名の脇に小さく出す補助名（諱）。無い場合は null。
 *
 * 通用名が「武帝」「太宗」だけでは人物が特定できず、諱（劉徹・李世民）で
 * 検索されることも多いため出している。**通用名に諱が含まれているときは出さない**
 * （「王莽」「太祖 朱全忠」のような重複表示を避ける）。
 *
 * @param id 皇帝id
 * @param personalName 諱（データ原文）
 * @param regimeId データの `regimeId`（清の姓の落としに使う）
 * @param displayName 1行目（重複判定に使う）
 * @param ethnicName 分けて持っている民族名（Issue #37 単位3）
 */
export function emperorSubtitle(
  id: string,
  personalName: string | null,
  regimeId: string,
  displayName: string,
  ethnicName: { kind: string; value: string } | null | undefined,
): string | null {
  if (id in SUBTITLE_OVERRIDES) return SUBTITLE_OVERRIDES[id];
  if (ethnicName && ETHNIC_SUBTITLE_KINDS.has(ethnicName.kind)) {
    return displayName.includes(ethnicName.value) ? null : ethnicName.value;
  }
  if (!personalName) return null;
  // 清の11人は「愛新覚羅」＋諱。姓を落として諱だけを出す。
  const name =
    regimeId === "qing" ? personalName.replace(/^愛新覚羅/, "") : personalName;
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

// かつてここに `ETHNIC_NAME_LABEL`（政権 ID → 括弧の中の名前の種類）と
// `RENAMED_NAME_IDS`（北漢の劉崇＝のちの劉旻）があった。**2026-08-03 に32件すべてを
// `name.ethnicName` へ分けた**（Issue #37 単位3）ので、サイト側で括弧を割る経路は無い。
// ラベルは `meta.catalogs.ethnicNameKinds`、改名は `aliases`（「別名」の行）が持つ。
// 括弧つきの `personalName` はゲートE（validate_emperors.py・天井 0）が止めるので、
// この経路が要る形はもうデータに入って来られない。

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
  dynastyKey: string;
  name: string;
  commonName: string;
  personalName: string | null;
  /** 民族名（Issue #37 単位3）。ラベルは `kind` が決めるので政権を見ない。 */
  ethnicName: { value: string; label: string; counterpartLabel: string } | null;
  /** 字（Issue #37 単位4・92人）。 */
  courtesyName: string | null;
  /** 幼名＝原文の「小字」（Issue #37 単位5・30人）。 */
  childhoodName: string | null;
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

  // 諱と民族名。ラベルは kind から決まっている（相手側 personalName のラベルも
  // counterpartLabel）ので、**ここで政権を見る必要がない**（Issue #37 単位3）。
  if (r.personalName && r.ethnicName) {
    push(r.ethnicName.counterpartLabel, r.personalName);
    push(r.ethnicName.label, r.ethnicName.value);
  } else if (r.personalName) {
    push("諱", r.personalName);
  }

  // 字と幼名（Issue #37 単位4・5）。**諱のすぐ後ろ**に置く — 原典の書き出しが
  // 「諱〈諱〉，字〈字〉，小字〈小字〉」の順で並べており、廟号・諡号（死後に贈られる名）
  // より前に来るのが本人が名乗った名前の並びとして自然なため。
  //
  // **金章宗・衛紹王では幼名が出ない。** 女真語の名を金史が「小字」として載せており
  // 民族名と同じ値になるので、上の `push` が値の重複として落とす（同じ名前が
  // ラベル違いで2つ並ぶのを避ける既存の作り。落ちるのは2人だけ）。
  push("字", r.courtesyName);
  push("幼名", r.childhoodName);

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
  } else if (inner) {
    for (const part of inner.split("、")) {
      // 諱の再掲（「少帝（懿）」）と注記（「泰定帝（通称）」）は行にしない。
      if (part === "通称" || (r.personalName ?? "").includes(part)) continue;
      push("別称", part);
    }
  }
  if (!isEraName) {
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
