"use client";

// 皇帝1人の全項目（名称・在位・死因・即位経路・年齢・回数系8項目）を表示する
// 詳細ダイアログ。皇帝一覧カードとランキング棒グラフの行クリックの両方から開く、
// 統計ページ横断の共通部品。表示本体はemperor-detail-body.tsx（個別ページと共用）。

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmperorDetailBody,
  dynastyContextLabel,
} from "@/components/emperors/emperor-detail-body";
import { EmperorNarrativeDialogSection } from "@/components/emperors/emperor-narrative-dialog";
import type { EmperorRecord } from "@/lib/emperor-types";

export function EmperorDetailDialog({
  record,
  onClose,
  prev = null,
  next = null,
  onNavigate,
}: {
  record: EmperorRecord | null;
  onClose: () => void;
  /** 前後の皇帝（一覧ダイアログの送りナビ用。省略時はナビ非表示＝チャートからの利用）。 */
  prev?: EmperorRecord | null;
  next?: EmperorRecord | null;
  onNavigate?: (record: EmperorRecord) => void;
}) {
  // ←/→キーでも前後の皇帝へ送る（ダイアログ内に入力欄はないので素のまま拾ってよい）。
  const onKeyDown = onNavigate
    ? (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        if (e.key === "ArrowLeft" && prev) onNavigate(prev);
        if (e.key === "ArrowRight" && next) onNavigate(next);
      }
    : undefined;
  return (
    <Dialog open={record !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg lg:max-w-3xl"
        onKeyDown={onKeyDown}
      >
        {record && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-xl">
                {record.name}
              </DialogTitle>
              {/* 個別ページへの導線はスクロールなしで見える位置（ヘッダー）に常設する。
                  最下部のリンクは経緯を読み終えた後の導線として残している。 */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <DialogDescription>
                  {dynastyContextLabel(record)}
                </DialogDescription>
                <span className="flex items-center gap-1">
                  <Link
                    href={`/emperors/${record.id}`}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-sm text-seal underline underline-offset-2 hover:text-seal/80"
                  >
                    <ExternalLink aria-hidden className="size-3.5" />
                    個別ページへ
                  </Link>
                  {onNavigate && (
                    <span className="ml-1 flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={!prev}
                        aria-label={prev ? `前の皇帝: ${prev.name}` : "前の皇帝なし"}
                        title={prev ? `前の皇帝: ${prev.name}（←キー）` : undefined}
                        onClick={() => prev && onNavigate(prev)}
                      >
                        <ChevronLeft />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={!next}
                        aria-label={next ? `次の皇帝: ${next.name}` : "次の皇帝なし"}
                        title={next ? `次の皇帝: ${next.name}（→キー）` : undefined}
                        onClick={() => next && onNavigate(next)}
                      >
                        <ChevronRight />
                      </Button>
                    </span>
                  )}
                </span>
              </div>
            </DialogHeader>
            {/* lg以上ではダイアログを広幅にして個別ページと同じ2カラム表示を流用する
                （動画は折りたたみのまま＝ダイアログ内スクロールを増やさない）。 */}
            <EmperorDetailBody record={record} wide collapseVideos />
            {/* 経緯2節はダイアログを開いた時だけJSONをlazy fetchして表示する
                （EmperorRecordにnoteを載せないため）。取得失敗時は非表示。 */}
            <EmperorNarrativeDialogSection id={record.id} />
            {/* deep-link: この内容を固定URLで共有できる個別ページへの導線 */}
            <p className="text-xs">
              <Link
                href={`/emperors/${record.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-seal"
              >
                <ExternalLink aria-hidden className="size-3" />
                この皇帝の個別ページを開く
              </Link>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * 詳細ダイアログの開閉状態をチャート本体から分離するフック（scroll-bar-chart.tsxの
 * useTipOutletと同じ方式）。開閉のたびにNivoチャート全体が再レンダリングされるのを
 * 避けるため、状態はDetailOutlet（ダイアログだけを描く小さな子コンポーネント）が持ち、
 * チャート側は安定参照のopenDetailを呼ぶだけにする。
 */
export function useDetailOutlet(): {
  /** ダイアログを開く。チャート側のクリックハンドラから呼ぶ。 */
  openDetail: (record: EmperorRecord) => void;
  /** ダイアログの描画位置に置くコンポーネント。 */
  DetailOutlet: () => ReactNode;
} {
  const setterRef = useRef<((record: EmperorRecord | null) => void) | null>(null);
  const openDetail = useCallback((record: EmperorRecord) => {
    setterRef.current?.(record);
  }, []);
  const DetailOutlet = useCallback(
    () => <DetailOutletInner setterRef={setterRef} />,
    [],
  );
  return { openDetail, DetailOutlet };
}

function DetailOutletInner({
  setterRef,
}: {
  setterRef: RefObject<((record: EmperorRecord | null) => void) | null>;
}) {
  const [record, setRecord] = useState<EmperorRecord | null>(null);
  useEffect(() => {
    setterRef.current = setRecord;
    return () => {
      setterRef.current = null;
    };
  }, [setterRef]);
  return <EmperorDetailDialog record={record} onClose={() => setRecord(null)} />;
}
