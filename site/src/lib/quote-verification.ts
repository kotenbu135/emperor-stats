// 引用照合の到達点を /about に出すための集計（ビルド時に data/quote-refs.json を読む）。
//
// **数を直書きしない。** #38（引用の全件照合）は 2026-08-03 に「完走しない」と決めた
// うえで、その線引きを /about から読めるようにする（Issue #69・計画6節）。取り下げを
// 明示する文なので、そこに書く件数が実態からずれると取り下げの説明そのものが嘘になる。
// 台帳から引けば台帳が動いた時点で文も動く（`stats.emperorCount` と同じ扱い）。
//
// quote-refs.json は配布物ではなく内部 QA 用の台帳で、`scripts/verify_quotes.py` が
// 生成・更新する。ここで読むのは status の内訳だけなので、クライアントに載るのは
// 下の5つの数値のみ（台帳の本体はビルド時のサーバ側に留まる）。

import fs from "node:fs";
import path from "node:path";

/** 台帳の status（意味は scripts/verify_quotes.py の冒頭コメントが正）。 */
interface QuoteRef {
  status?: string;
}

export interface QuoteVerificationStats {
  /** 台帳に登録されている引用の件数。 */
  total: number;
  /** 底本（ローカルコーパス）と機械で突き合わせた件数（status: cache / corpus）。 */
  verified: number;
  /** 人が個別に確認した件数（status: manual）。機械では再検証していない。 */
  manual: number;
  /** ローカル底本の外にある資料からの引用（status: external）。照合の対象外。 */
  external: number;
  /** 底本で該当箇所を確認できていない件数（status: unresolved）。 */
  unresolved: number;
}

const refsPath = path.join(process.cwd(), "..", "data", "quote-refs.json");

function loadQuoteVerificationStats(): QuoteVerificationStats {
  const ledger = JSON.parse(fs.readFileSync(refsPath, "utf-8")) as {
    refs: Record<string, QuoteRef>;
  };
  const counts = new Map<string, number>();
  for (const ref of Object.values(ledger.refs)) {
    const status = ref.status ?? "unknown";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const at = (status: string) => counts.get(status) ?? 0;
  return {
    total: Object.keys(ledger.refs).length,
    verified: at("cache") + at("corpus"),
    manual: at("manual"),
    external: at("external"),
    unresolved: at("unresolved"),
  };
}

export const quoteVerificationStats = loadQuoteVerificationStats();
