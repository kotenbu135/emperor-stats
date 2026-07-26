---
version: alpha
name: 中国皇帝統計
description: 秦の始皇帝から清の宣統帝まで365人の在位年数・死因・即位経路などを正史原典に基づき可視化する静的統計サイト。
colors:
  background: "#f5f1e8"
  foreground: "#3a3530"
  card: "#f5f1e8"
  card-foreground: "#3a3530"
  popover: "#f5f1e8"
  popover-foreground: "#3a3530"
  primary: "#4a4038"
  primary-foreground: "#f5f1e8"
  secondary: "#ede7d8"
  secondary-foreground: "#3a3530"
  muted: "#ede7d8"
  muted-foreground: "#6b6258"
  accent: "#ddd5c7"
  accent-foreground: "#3a3530"
  seal: "#a6321c"
  seal-foreground: "#f5f1e8"
  destructive: "#a6321c"
  border: "#ddd5c7"
  input: "#ddd5c7"
  ring: "#4a4038"
  sidebar: "#ede7d8"
  sidebar-foreground: "#3a3530"
  sidebar-primary: "#4a4038"
  sidebar-primary-foreground: "#f5f1e8"
  sidebar-accent: "#ddd5c7"
  sidebar-accent-foreground: "#3a3530"
  sidebar-border: "#ddd5c7"
  sidebar-ring: "#4a4038"
  series-1: "#2a78d6"
  series-2: "#008300"
  series-3: "#e87ba4"
  series-4: "#eda100"
  series-5: "#1baf7a"
  series-6: "#eb6834"
  series-7: "#4a3aa7"
  series-8: "#e34948"
  kinship-minor: "#8d7c94"
typography:
  sans:
    fontFamily: Noto Sans JP
  heading:
    fontFamily: Noto Serif JP
  title:
    fontFamily: Noto Serif JP
    fontSize: 1.5rem
    fontWeight: 600
  title-wide:
    fontFamily: Noto Serif JP
    fontSize: 1.875rem
    fontWeight: 600
  section:
    fontFamily: Noto Serif JP
    fontSize: 1.25rem
    fontWeight: 600
  subsection:
    fontFamily: Noto Serif JP
    fontSize: 1rem
    fontWeight: 600
  body:
    fontFamily: Noto Sans JP
    fontSize: 0.875rem
    lineHeight: 1.625
  caption:
    fontFamily: Noto Sans JP
    fontSize: 0.75rem
  micro:
    fontFamily: Noto Sans JP
    fontSize: 0.6875rem
rounded:
  base: 0.5rem
spacing:
  gutter: 1.5rem
  gutter-wide: 2.5rem
  section: 2rem
  block: 1.5rem
  stack: 0.5rem
  inline: 0.375rem
---

## Overview

正史（本紀・列伝）を1件ずつ原典確認して集計した365人分のデータセットを、統計として読ませるための閲覧サイト。デザイン方針は**水墨文人スタイル**で、墨の濃淡を基調にした抑制的な配色を地とし、朱色は印章のワンポイントとしてのみ差す。史料を扱う媒体としての落ち着きを、装飾ではなく余白と階調で表現する。

## Colors

地色は宣紙色 `{colors.background}`、本文は墨色 `{colors.foreground}` を基準にする。面の区別は色相ではなく明度で行い、サイドバー・モバイルヘッダー・オフキャンバスメニューには生成り `{colors.sidebar}` を当てて本文の面と分ける。

`{colors.seal}` は印章の朱であり、強調色ではない。ランキング1位バッジ、見出し脇のアクセントバー、統計数値、現在地を示すナビ項目のように「ここぞという箇所」に限って使う。複数の要素へ同時に当てると、水墨基調の抑制が失われる。

`{colors.series-1}` から `{colors.series-8}` は死因・即位経路のような列挙カテゴリ専用のパレットで、`{colors.background}` を背景としてCVD安全性とコントラストを検証済みの組み合わせである。この8色を単一エンティティの棒グラフやブランド表現へ流用しない。コントラストが不足するスロットは、凡例だけに頼らず直接ラベルを併記して補う。

`{colors.kinship-minor}` は系譜図における群雄・並立政権の表現専用色で、`{colors.series-1}` から `{colors.series-8}` のいずれとも衝突しないよう選んである。灰色で代用すると非皇帝ノードの破線表現と混同されるため、置き換えない。

チャート・カラー・レイアウトを新規に作る際は dataviz skill の手順を通し、配色は `scripts/validate_palette.js` でCVD安全性を検証してから確定する。

## Typography

見出しは明朝体 `{typography.heading.fontFamily}`、本文とUIはゴシック体 `{typography.sans.fontFamily}` で書き分ける。この対比が水墨文人スタイルの主要な表現手段であるため、見出しをゴシックへ寄せない。

サイズは6段に限る。ページタイトルは `{typography.title}`（広い画面では `{typography.title-wide}`）、セクション見出しは `{typography.section}`、その配下の小見出しは `{typography.subsection}`、本文は `{typography.body}`、ラベルと注記は `{typography.caption}`、チャートとSVG内のラベルは `{typography.micro}` を使う。

`{typography.micro}` はチャートとSVG内のラベル専用であり、これ以外の用途に生のピクセル値を書かない。小見出しを本文と同じサイズにしない。階層が潰れて見出しとして機能しなくなる。

日本語は任意の文字位置で改行されるため、見出しと本文には改行制御を必ず添える。制御のない見出しは単語の途中で折り返す。

## Layout

余白も5段に限る。ページの左右は `{spacing.gutter}`（広い画面では `{spacing.gutter-wide}`）、セクションの上下は `{spacing.section}`、見出しから中身までは `{spacing.block}`、段落の間は `{spacing.stack}`、ラベルと入力・アイコンと文字の間は `{spacing.inline}` を使う。

これらの余白は共有の見出し・セクションコンポーネントが供給する。ページ側で独自のレイアウトを組む場合も同じ段階から選び、中間値を作らない。

統計ページは全幅を使い、見出しを左寄せにする。散文が主体の記事型ページのみ列幅を制限して中央寄せにし、その場合は見出しを本文と同じ列幅・同じ中心へ揃える。中央寄せの列幅は本文と見出しで必ず一致させる。

デスクトップでは固定幅のサイドバーにナビゲーションを常時表示し、モバイルではヘッダーとオフキャンバスメニューへ切り替える。

ナビゲーションのカテゴリは既定で閉じ、現在表示中のページが属するカテゴリだけを開く。カテゴリ見出しのクリックは配下先頭ページへの遷移、右端シェブロンのクリックは開閉として役割を分ける。手動の開閉状態はページ遷移をまたいで維持する。

## Components

ページタイトルとセクション見出しは共有の見出しコンポーネントから供給し、ページ側で同じ体裁を書き起こさない。見出しの左には印泥をイメージした朱の縦バーを添える。

皇帝一覧のカードは固定アスペクト比の枠を持ち、肖像画は `object-fit: cover` と `object-position: top` で表示する。中国の伝統的な人物画は顔が上部寄りに配置されるため、この組み合わせで顔を切らずに枠へ収める。肖像画のない人物は同じ枠サイズで、姓一文字のモノグラムをプレースホルダーとして表示する。

## Do's and Don'ts

- ダークモードを実装しない。ライトテーマのみを提供する。
- 朱印スタンプ風の強調要素を多用しない。
- 肖像画を `object-fit: contain` と余白埋めで表示しない。カードごとの画像占有面積がばらつき、一覧の均一感が失われる。
