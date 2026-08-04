// 皇帝個別ページの「関連動画」節。emperor-detail-body.tsx の解体（2026-08-01）で
// ここへ移した。動画はすべて当サイトと無関係の外部チャンネルの制作物なので、
// 節の冒頭に必ず制作者表記を出す（lib/video-channel.ts の VIDEO_CHANNEL）。
//
// 折りたたみ（collapse）はダイアログ内スクロールを抑えるための分岐だったので、
// ダイアログの廃止にあわせて落とした。個別ページは常に開いた状態で出す。

import { YoutubeEmbed } from "@/components/emperors/youtube-embed";
import type { EmperorRecord } from "@/lib/emperor-types";
import { VIDEO_CHANNEL } from "@/lib/video-channel";

export function EmperorVideosSection({ record }: { record: EmperorRecord }) {
  if (record.videos.length === 0) return null;
  return (
    <section className="space-y-2">
      {/* 見出しは h1（ヒーロー）の直下なので h2（h1→h3 のレベル飛び回避・
          2026-07-27 の SEO 監査 2-2）。見た目のサイズは他の節と同じ。 */}
      <h2 className="font-heading text-base font-semibold text-foreground">
        関連動画
      </h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        当サイトとは無関係の外部YouTubeチャンネル「
        <a
          href={VIDEO_CHANNEL.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-seal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
        >
          {VIDEO_CHANNEL.name}
        </a>
        」様が制作・公開されている解説動画です。
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {record.videos.map((video) => (
          <YoutubeEmbed key={video.videoId} video={video} />
        ))}
      </div>
    </section>
  );
}
