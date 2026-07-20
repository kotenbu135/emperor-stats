"use client";

// 皇帝1人の全項目（名称・在位・死因・即位経路・年齢・回数系8項目）を表示する
// 詳細ダイアログ。皇帝一覧カードとランキング棒グラフの行クリックの両方から開く、
// 統計ページ横断の共通部品。表示本体はemperor-detail-body.tsx（個別ページと共用）。

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
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
import type { EmperorRecord } from "@/lib/emperor-types";

export function EmperorDetailDialog({
  record,
  onClose,
}: {
  record: EmperorRecord | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={record !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {record && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-xl">
                {record.name}
              </DialogTitle>
              <DialogDescription>
                {dynastyContextLabel(record)}
              </DialogDescription>
            </DialogHeader>
            <EmperorDetailBody record={record} />
            {/* deep-link: この内容を固定URLで共有できる個別ページへの導線 */}
            <p className="text-xs">
              <Link
                href={`/emperors/${record.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2 hover:text-seal"
              >
                <ExternalLink aria-hidden className="size-3" />
                この皇帝の個別ページを開く（リンク共有用）
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
