"use client";

// 皇帝の肖像表示（一覧カード・個別ページのヒーローで共用）。肖像がない皇帝は
// 姓一文字のモノグラムをプレースホルダー表示する。
//
// 【実体は 360×480(3:4) のまま・切る位置は1枚ずつ決める】
// 2026-07-31 に一覧カードを3:4へ変え、カード内の肖像枠はほぼ正方形になった。
// 実体を切り直さないのは、枠が実体より横長のあいだ `object-cover` が縦だけを切るので
// **どこを切るかを決めさえすれば切り直した場合と同じ絵が出る**ため（幅ごとの撮り比べで
// 確認済み）。むしろ実体を正方形に詰めると、枠が
// 1:1 より縦長になる幅で今度は左右が切られて顔が欠けるし、3:4のまま出す詳細ダイアログで
// 下1/4がどこにも出なくなる。実体を全ての枠より縦長に保つ＝縦切り一本にする、が安全側。
//
// **ただし「上寄せ」という固定ルートは誤りだった**（2026-07-31 ユーザー指摘）。
// 題字が上端に入る版本（三才圖會の「漢武帝像」など）や、顔が中央にある元の御容では、
// 上を残すと題字と余白が枠を占め**顔が下半分に沈む**。切る位置は絵ごとに違うので、
// 150枚を1枚ずつ目視して顔の位置（manifest.json の `focusY`）を入れ、下の
// `focusObjectPositionY` で `object-position` へ直している。
// images.unoptimized の next/image は srcset を出さず常に360pxフルを配信して
// しまうため、sync-portraits.mjs が生成する320pxサムネ（/portraits/thumb/）と
// 併記した srcset 付きの素の<img>で出し分ける（1x表示・ダイアログの小サイズ
// 表示はサムネ側が選ばれ、一覧150枚超の転送量が減る）。

import type { EmperorRecord } from "@/lib/emperor-types";

/** 肖像表示に必要な最小フィールド（一覧の軽量レコード・フルレコードの両方が満たす）。 */
type PortraitSubject = Pick<
  EmperorRecord,
  "name" | "familyName" | "portraitUrl" | "portraitFocusY"
>;

/** 肖像アセットの縦横比（360×480）。 */
const ASSET_AR = 3 / 4;
/** カード内の肖像枠の縦横比。カード全体を3:4にした結果ほぼ正方形になる
 *  （0.99@1440px〜1.28@320px・SITE_DESIGN.md の「7. 皇帝一覧」節）。代表値で計算する。 */
const CARD_IMAGE_AR = 1;
/** 顔の中心を枠のどこに置くか（上端からの割合）。中央より少し上が肖像画の据わりが良い。 */
const FACE_TARGET = 0.35;

/**
 * 目視で入れた顔の位置（`focusY`）を CSS の `object-position` の Y へ直す。
 *
 * `object-position: 50% P%` は「画像の P の点を枠の P の点に合わせる」指定で、
 * 「顔を枠の35%に置く」を直接は書けない。`cover` で縦が余るとき、ずらし量は
 * `(画像高 - 枠高) × P` なので、顔が枠の中で `focusY×画像高 - (画像高-枠高)×P` の
 * 位置に出る。これを `FACE_TARGET×枠高` と等しく置いて P について解いたのが下の式。
 *
 * 枠の比率は幅で 0.99〜1.28 と動くが、`CARD_IMAGE_AR` を1として出した P を他の比率へ
 * 持って行っても顔の位置は数%しかずれない（余りの量と必要なずらし量が同じ向きに動くため）。
 * 幅ごとに値を持たない理由がこれ。
 *
 * **0〜1に丸める点が肝**: `focusY` が約0.26より小さい肖像（立像・全身像の多く）は
 * P が負になり0＝上寄せに落ちる。つまりこの仕組みは**顔が下に沈んでいる肖像だけを動かす**。
 * 逆に約0.51より下に顔がある肖像は1＝下寄せでも足りず、顔は狙いより下に残る
 * （実体の下端が既に切れているため。該当が出たら jpg から切り直すのが筋）。
 */
function focusObjectPositionY(focusY: number): number {
  const imgH = 1 / ASSET_AR;
  const boxH = 1 / CARD_IMAGE_AR;
  const p = (focusY * imgH - FACE_TARGET * boxH) / (imgH - boxH);
  return Math.min(1, Math.max(0, p));
}

/** モノグラムに使う一文字。姓を優先し、なければ通称の頭文字を使う。
 *  **姓を別欄に分ける前は諱の頭文字を取っていた**（諱が姓＋諱だったので同じ字が出る・
 *  Issue #37 単位6）。姓を持たない12人（モンゴル語名の漢字音写）はここで通称に落ちる。 */
function monogramChar(record: PortraitSubject): string {
  return (record.familyName ?? record.name).charAt(0);
}

/**
 * 肖像がない皇帝のプレースホルダー（姓一文字を大きく表示）。
 *
 * **下地は無彩色**（2026-07-31 ユーザー決定・SITE_DESIGN.md の「7. 皇帝一覧」節）。
 * 2026-07-31 まではその皇帝の王朝色（`--series-1〜8`）を地に38%混ぜた淡彩だったが、
 * 一覧365枚のうち**220枚（60%）が肖像なし**で、時代によっては面の8割がこの淡彩になる
 * （五胡十六国84%・南北朝80%）。さらにこの下地が担っていた2つの符号は、
 * どちらも同じカードの文字と重複していた — 色＝王朝は2行目の `dynastyLabel` が、
 * 字＝姓は1行目の諱が既に出している。`--series-1〜8` は図で系列を見分けるための
 * カテゴリ識別色で、面の60%に敷く下地の役ではない。
 *
 * 王朝の識別は**カードの文字列の左に立てる細い印**（`emperor-grid.tsx` の
 * `DynastyMark`）へ移した。そちらは肖像の有無にかかわらず全365枚に出る。
 *
 * 文字は `--muted-foreground`（`--muted` の上でコントラスト 4.35:1）。淡彩をやめると
 * 「読み込み中の枠」に見えないかが論点だった（38%という値自体、22%では読み込み中に
 * 見えるという指摘を受けて上げた経緯がある）が、**モノグラムが8割を占める南北朝で
 * 実物を確認して問題なしと判断した**（2026-07-31・`rebuild-shots/emperors-now-monogram-heavy.png`）。
 * カードの下に名前・王朝・在位期間が必ず出るので、下地だけでは読み込み中に見えない。
 */
function Monogram({ char, large = false }: { char: string; large?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <span
        className={`select-none font-heading font-semibold text-muted-foreground ${
          large ? "text-6xl" : "text-4xl"
        }`}
      >
        {char}
      </span>
    </div>
  );
}

/** sync-portraits.mjs の出力配置（/portraits/{id}.webp と /portraits/thumb/{id}.webp）
 *  に依存してフルURLから320pxサムネのURLを導出する。 */
export function portraitThumbUrl(portraitUrl: string): string {
  return portraitUrl.replace("/portraits/", "/portraits/thumb/");
}

export function Portrait({
  record,
  sizes,
  large = false,
  priority = false,
}: {
  record: PortraitSubject;
  sizes: string;
  large?: boolean;
  /** ファーストビューのカードで指定する。既定のloading="lazy"だと先頭カードの
   *  肖像がLCP要素なのに読み込みが後回しになりLCPが大幅に悪化する
   *  （PERFORMANCE.mdのLighthouse計測記録）。 */
  priority?: boolean;
}) {
  if (!record.portraitUrl)
    return <Monogram char={monogramChar(record)} large={large} />;
  return (
    // unoptimized の next/image は srcset を出せない（カスタム srcSet 指定も不可）
    // ため、静的2サイズを自前 srcset で出す。
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={record.portraitUrl}
      srcSet={`${portraitThumbUrl(record.portraitUrl)} 320w, ${record.portraitUrl} 360w`}
      alt={`${record.name}の肖像`}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover"
      // 枠が実体(3:4)より横長のときだけ効く。3:4の枠（詳細ダイアログ・個別ページ）は
      // 余りが出ないので、この値を入れても表示は変わらない。
      style={{
        objectPosition:
          record.portraitFocusY === null
            ? "50% 0%"
            : `50% ${(focusObjectPositionY(record.portraitFocusY) * 100).toFixed(1)}%`,
      }}
    />
  );
}
