// next.config.tsのbasePathと同じ値（単一情報源）。
// next/imageはimages.unoptimized:true時にbasePathを自動付与しないため、
// publicディレクトリ配下のアセットを参照する箇所ではこの定数を明示的に使う。
// カスタムドメイン(emperorstats.com)はルート直下で配信されるためbasePath不要。
export const BASE_PATH = "";
