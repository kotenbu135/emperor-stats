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

/** ダイアログが積む履歴エントリのstate。Next.jsのpushStateパッチが内部キー
 *  （__NA・__PRIVATE_NEXTJS_INTERNALS_TREE）を同じオブジェクトへ合成するため、
 *  それらと衝突しないキー名にする。 */
interface DialogHistoryState {
  emperorDialog?: string;
}

function dialogHistoryMarker(): string | undefined {
  return (window.history.state as DialogHistoryState | null)?.emperorDialog;
}

/**
 * ダイアログの開閉をブラウザ履歴と同期する（モバイルの戻るボタンで一覧ごと
 * 離脱してしまう問題への対処。intercepting routesはoutput: "export"非対応のため
 * native History APIで実装する）。
 *
 * - 開くと履歴エントリを1つ積む。urlForを渡すとURLも個別ページに差し替える
 *   （Next.jsのpushStateパッチが現在のレンダーツリーをエントリへ保持するため、
 *   一覧を表示したままURLだけが変わり、リロード時は個別ページ本体が開く）。
 * - 戻るボタン（popstate）でダイアログを閉じ、進むで再入したら開き直す。
 * - UI操作（×・ESC・外側クリック）で閉じたときは自分の積んだエントリを
 *   history.back()で取り除く（戻る経由の閉では既にmarkerが消えているので、
 *   history.stateの確認だけで二重backを防げる）。
 * - ダイアログ内リンクで個別ページへ遷移した場合はエントリを残したまま
 *   アンマウントし、個別ページから戻ったときの復元は呼び出し側のマウント時
 *   復元（emperor-grid.tsx）に委ねる。
 */
function useDialogHistory({
  record,
  onClose,
  onRestore,
  urlFor,
}: {
  record: EmperorRecord | null;
  onClose: () => void;
  /** 進む（popstate）でダイアログのエントリへ再入したときに開き直すコールバック。 */
  onRestore?: (record: EmperorRecord) => void;
  /** 開いている間だけ差し替えるURL。省略時はURLを変えず履歴エントリだけ積む。 */
  urlFor?: (record: EmperorRecord) => string;
}) {
  const prevRef = useRef<EmperorRecord | null>(null);
  // 進むで再入したときの復元用に、最後に開いた皇帝を覚えておく。
  const lastOpenedRef = useRef<EmperorRecord | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = record;
    const marker = dialogHistoryMarker();
    if (record) {
      lastOpenedRef.current = record;
      // 既に自分のエントリが最前（popstate復元・StrictModeの再実行）なら何もしない。
      if (marker === record.id) return;
      const state: DialogHistoryState = { emperorDialog: record.id };
      if (prev) {
        // ダイアログ内の前後送り: エントリは増やさず差し替える（履歴スパム防止）。
        window.history.replaceState(state, "", urlFor?.(record));
      } else {
        window.history.pushState(state, "", urlFor?.(record));
      }
    } else if (prev && marker === prev.id) {
      window.history.back();
    }
  }, [record, urlFor]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const id = (e.state as DialogHistoryState | null)?.emperorDialog;
      if (!id) {
        // ダイアログのエントリから離れた（戻る）。閉じているときは何もしない
        // （ページ内アンカー等、無関係な履歴移動でも発火するため）。
        onClose();
      } else if (onRestore && lastOpenedRef.current?.id === id) {
        onRestore(lastOpenedRef.current);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [onClose, onRestore]);
}

export function EmperorDetailDialog({
  record,
  onClose,
  prev = null,
  next = null,
  onNavigate,
  onRestore,
  historyUrlFor,
}: {
  record: EmperorRecord | null;
  onClose: () => void;
  /** 前後の皇帝（一覧ダイアログの送りナビ用。省略時はナビ非表示＝チャートからの利用）。 */
  prev?: EmperorRecord | null;
  next?: EmperorRecord | null;
  onNavigate?: (record: EmperorRecord) => void;
  /** 進む（popstate）での再入時に開き直すコールバック（useDialogHistory参照）。 */
  onRestore?: (record: EmperorRecord) => void;
  /** 開いている間のURL（useDialogHistory参照）。安定参照（useCallback等）で渡すこと。 */
  historyUrlFor?: (record: EmperorRecord) => string;
}) {
  useDialogHistory({ record, onClose, onRestore, urlFor: historyUrlFor });
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
                  {/* onCloseは呼ばない: 履歴同期のhistory.back()とルーター遷移の
                      pushStateが競合するため。遷移すればページごとアンマウントされる。 */}
                  <Link
                    href={`/emperors/${record.id}`}
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
  // onRestoreを渡し、戻るで閉じたあと進むで再入したときに開き直せるようにする
  // （URLは変えない＝履歴エントリだけの同期。urlForは一覧グリッド専用）。
  return (
    <EmperorDetailDialog
      record={record}
      onClose={() => setRecord(null)}
      onRestore={setRecord}
    />
  );
}
