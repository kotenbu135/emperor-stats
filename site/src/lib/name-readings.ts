// 皇帝名・政権名・時代ラベルの読み（`../data/name-readings.json`・GitHub Issue #20）。
// 方針と機械ゲートは docs/site-design/RUBY_PLAN_2026-08-01.md。
//
// **ビルド時にだけ動くサーバー専用モジュール**（node:fs に依存する）。クライアントへは
// ルビ記法に変換済みの文字列だけが props で渡り、描画は components/ui/ruby-text.tsx。
//
// 読みは日本語の慣用読みで、正史原典から出る値ではない。だから emperors.json を
// 拡張せず別ファイルに置いている（紹介文 emperor-profiles.json と同じ理由）。
//
// キーは画面に出る平文そのもの、値は同じ文字列にルビ注釈を付けたもの。
// 同じ文字列が複数の皇帝で使われる廟号・諡号（武帝17人・明帝14人…計46件）は
// **読みが一意**なので、人物ごとの上書きは持たない（実測して確認済み・方針5-2節）。

import fs from "node:fs";
import path from "node:path";
import { assertValidRubySource, stripRuby } from "@/lib/ruby";

const readingsPath = path.join(
  process.cwd(),
  "..",
  "data",
  "name-readings.json",
);

const nameReadings = (
  JSON.parse(fs.readFileSync(readingsPath, "utf-8")) as {
    names: Record<string, string>;
  }
).names;

// 記法の破損と親文字の打ち間違いをビルドで止める。
// 「ルビを剥がすとキーに戻る」が成り立たない行は、親文字を書き間違えているか
// 対応する平文が変わったかのどちらかで、そのまま出すと画面の名前が変わってしまう。
for (const [plain, annotated] of Object.entries(nameReadings)) {
  assertValidRubySource(annotated, `name-readings.json の「${plain}」`);
  const stripped = stripRuby(annotated);
  if (stripped !== plain) {
    throw new Error(
      `name-readings.json の「${plain}」はルビを剥がすと「${stripped}」になります。` +
        `親文字はキーと1文字ずつ一致させてください`,
    );
  }
}

/** 漢字を1文字でも含むか（かなだけの補助名「クビライ」等はルビの対象外）。 */
const HAS_KANJI = /[\u3400-\u9fff\uf900-\ufaff]|[\u{20000}-\u{3ffff}]/u;

/**
 * 平文にルビ記法を付けて返す。
 *
 * **画面に出る漢字入りの文字列が未登録ならビルドを落とす**（2026-08-01 に全885件が
 * そろったので、素通しの緩いモードは畳んだ）。皇帝を追加収録したときや表示名の
 * 作り方を変えたときは data/name-readings.json に読みを足すこと。
 * 緩いまま配信すると、肖像を manifest から外したのに画像ファイルが残った
 * 2026-08-01 のデプロイ事故と同じ形になる。
 */
export function rubyOf(plain: string | null | undefined): string {
  if (!plain) return "";
  const annotated = nameReadings[plain];
  if (annotated) return annotated;
  if (HAS_KANJI.test(plain)) {
    throw new Error(
      `ふりがな未登録の表示名です（Issue #20）: 「${plain}」。` +
        `data/name-readings.json に「｜親文字《ルビ》」で追記してください`,
    );
  }
  return plain;
}

let reported = false;

/**
 * ビルドログに `ふりがな: n/m 件` を出す。**未完成のまま配信されないための警報**なので
 * 静かにしないこと。同一プロセスで何度呼ばれても1回だけ出す。
 */
export function reportReadingCoverage(displayedNames: Iterable<string>): void {
  if (reported) return;
  reported = true;
  // 漢字を含まない文字列（「クビライ」のようなカタカナだけの補助名）はルビの対象外。
  const all = new Set(
    [...displayedNames].filter((s) => /[\u3400-\u9fff\uf900-\ufaff]|[\u{20000}-\u{3ffff}]/u.test(s)),
  );
  // **画面に出る文字列の正はサイト側**（時代ラベル15区分・王朝名の時代サフィックス・
  // カードの補助名は data/emperors.json には無い形で作られる）。読みを書き足す人が
  // 対象の一覧を引けるように、ビルドのたびに書き出す（.gitignore 対象）。
  try {
    fs.writeFileSync(
      path.join(process.cwd(), ".ruby-displayed.json"),
      JSON.stringify([...all].sort(), null, 1),
    );
  } catch {
    // 書けなくてもビルドは続ける（読みの解決には使っていない）。
  }
  const missing = [...all].filter((s) => !(s in nameReadings));
  const done = all.size - missing.length;
  // rubyOf は未登録で throw するので、ここに来る時点で missing は空のはず。
  // 数字を出し続けるのは、面を足したときに分母が増えるのを見えるようにするため。
  console.log(
    `ふりがな（Issue #20）: ${done}/${all.size} 件` +
      (missing.length > 0 ? `（未登録: ${missing.slice(0, 8).join("・")}）` : ""),
  );
}
