"use client";

// 詳細ダイアログ内の「即位の経緯」「死因の経緯」節。全統計ページのクライアントprops
// （EmperorRecord）にはnote全文を載せない方針のため、ダイアログを開いた時だけ
// public/emperor-notes/{id}.json（build-emperor-notes.mjsが生成）をfetchして表示する。
// 取得失敗・経緯なしのときは何も出さない（既存のダイアログ表示は壊さない）。
// 年表は載せない（個別ページへの導線に任せる）。

import { useEffect, useState } from "react";
import { NarrativeBlock } from "@/components/emperors/emperor-narrative";
import { BASE_PATH } from "@/lib/base-path";
import type { EmperorNarrativeNotes } from "@/lib/emperor-types";

export function EmperorNarrativeDialogSection({ id }: { id: string }) {
  // ダイアログは使い回される（idが変わる）ため、取得結果はidと一緒に持つ。
  // 表示するnotesはid一致時のみ派生させ、id変更直後は自動的に非表示になる
  // （effect内の同期setStateを避けるためstateのリセットはしない）。
  const [loaded, setLoaded] = useState<{
    id: string;
    notes: EmperorNarrativeNotes | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`${BASE_PATH}/emperor-notes/${id}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: EmperorNarrativeNotes | null) => {
        if (active) setLoaded({ id, notes: data });
      })
      .catch(() => {
        // 経緯なしの皇帝はJSON自体が無い（404）。静かに非表示のままにする。
      });
    return () => {
      active = false;
    };
  }, [id]);

  const notes = loaded?.id === id ? loaded.notes : null;
  if (!notes || (!notes.accession && !notes.death)) return null;

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      {notes.accession && (
        <NarrativeBlock title="即位の経緯" section={notes.accession} />
      )}
      {notes.death && (
        <NarrativeBlock title="死因の経緯" section={notes.death} />
      )}
    </div>
  );
}
