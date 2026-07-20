"use client";

// YouTube動画のクリック読み込み式埋め込み（facade）。初期表示は小サムネイル+
// タイトルのコンパクトな行（派手なサムネイル画像がページの水墨調を支配しない
// よう小さく抑える）で、クリックしてはじめて全幅のiframe（YouTube埋め込みの
// 重いJS）に置き換える。皇帝個別ページ・詳細ダイアログの両方で
// EmperorDetailBody経由で複数個描画されうるため、自動読み込みにするとperfへの
// 影響が大きい。

import { useState } from "react";
import Image from "next/image";
import type { EmperorVideo } from "@/lib/emperor-types";
import { VIDEO_CHANNEL } from "@/lib/video-channel";

export function YoutubeEmbed({ video }: { video: EmperorVideo }) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      // sm:col-span-full: 個別ページのグリッド表示では再生開始時にセル幅の
      // 小さなプレイヤーにならないよう全幅に広げる（縦リスト内では効かず無害）
      <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-black sm:col-span-full">
        <iframe
          src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
          title={video.title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className="group flex w-full items-center gap-3 rounded-md border border-border/60 bg-card p-2 text-left transition-colors hover:border-border hover:bg-secondary/60"
      aria-label={`動画「${video.title}」をこのページ内で再生`}
    >
      <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-sm border border-border/60 sm:w-40">
        <Image
          src={video.thumbnailUrl}
          alt=""
          fill
          sizes="160px"
          className="object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm leading-snug text-foreground">
          {video.title}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          YouTube・{VIDEO_CHANNEL.name}
        </span>
      </span>
    </button>
  );
}
