// 関連動画の制作元チャンネル情報。動画はすべて単一の外部チャンネルの公開
// プレイリスト由来（data/emperor-videos.json の meta.channel と同内容）。
// 当サイトとは無関係の制作者であることを表示する義務があるため、
// 動画を表示する箇所（emperor-detail-body.tsx）と /about で必ず参照する。

export const VIDEO_CHANNEL = {
  name: "鳥人間 中国史三昧",
  url: "https://www.youtube.com/@c-history",
} as const;
