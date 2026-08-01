// 青空文庫式ルビ記法（`｜親文字《ルビ》`）のパーサ。GitHub Issue #20。
// 方針と機械ゲートの全文は docs/site-design/RUBY_PLAN_2026-08-01.md。
//
// 皇帝名の読み（data/name-readings.json）と紹介文（data/emperor-profiles.json）の
// 両方が同じ記法で書かれるので、変換はこの1本に集約する。
//
// **React に依存しない純粋関数だけを置く**（描画は components/ui/ruby-text.tsx）。
// 読みは一覧グリッドやデータベース表のような Client Component にも props で渡るため、
// kana-readings.ts のようなサーバー専用モジュールにはできない。
//
// 記法の決まり:
// - `｜`（全角縦棒 U+FF5C）は**省略しない**。青空文庫では直前の漢字列に自動で係るが、
//   総ルビでは範囲の切れ目が曖昧になるので常に明示する
// - 本文に `｜`・`《`・`》` を書かない（エスケープを用意しない）。
//   壊れた記法は assertValidRubySource が落とす

/** ルビ付きなら ruby に読み、地の文なら null。 */
export interface RubySegment {
  text: string;
  ruby: string | null;
}

const RUBY_PATTERN = /｜([^｜《》]+)《([^｜《》]+)》/g;

/**
 * ルビ記法を「地の文」と「親文字＋読み」の並びへ分解する。
 *
 * 壊れた記法（対にならない `｜`・`《`・`》`）はそのまま地の文として返す
 * ——描画側で例外を投げるとページ全体が落ちるため。記法の違反は
 * assertValidRubySource（ビルド時のデータ読み込み）で捕まえる。
 */
export function parseRuby(source: string): RubySegment[] {
  const segments: RubySegment[] = [];
  let cursor = 0;
  for (const match of source.matchAll(RUBY_PATTERN)) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ text: source.slice(cursor, start), ruby: null });
    }
    segments.push({ text: match[1], ruby: match[2] });
    cursor = start + match[0].length;
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), ruby: null });
  }
  return segments;
}

/**
 * ルビを剥がした平文。`description`・JSON-LD・OGP・検索インデックスは必ずこちらを使う
 * （ルビ付きのまま渡すと「｜」がそのまま出る）。
 */
export function stripRuby(source: string): string {
  return source.replace(RUBY_PATTERN, "$1");
}

/**
 * ルビ注釈が1つでもあるか。無ければ描画側は素のテキストで済ませられる。
 * `RUBY_PATTERN` は /g なので test で lastIndex が動く。別のリテラルを使う。
 */
export function hasRuby(source: string): boolean {
  return /｜[^｜《》]+《[^｜《》]+》/.test(source);
}

/** ルビとして許すのはひらがな・カタカナ・長音・中黒だけ（音写名は原音カナで振る）。 */
const KANA_ONLY = /^[ぁ-ゖァ-ヺー・ゝゞヽヾ]+$/;

/**
 * 記法の違反を例外にする。データを読み込むビルド時のコードから呼ぶこと
 * （kana-readings・emperor-profiles の未知idアサートと同じ位置づけ）。
 *
 * @param label どのデータのどのキーかを例外文に出すための識別子
 */
export function assertValidRubySource(source: string, label: string): void {
  const rest = source.replace(RUBY_PATTERN, "");
  const stray = rest.match(/[｜《》]/);
  if (stray) {
    throw new Error(
      `ルビ記法が壊れています（${label}）: 対にならない「${stray[0]}」があります。` +
        `記法は ｜親文字《ルビ》 で、本文に ｜《》 は書けません: ${source}`,
    );
  }
  for (const { text, ruby } of parseRuby(source)) {
    if (ruby === null) continue;
    if (!KANA_ONLY.test(ruby)) {
      throw new Error(
        `ルビはかなのみで書きます（${label}）: 「${text}」に「${ruby}」が付いています`,
      );
    }
  }
}
