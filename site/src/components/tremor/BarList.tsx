// Tremor BarList [v0.1.1]

import React from 'react';

import { cx, focusRing } from '@/lib/tremor/utils';

type Bar<T> = T & {
  key?: string;
  href?: string;
  value: number;
  name: string;
};

interface BarListProps<T = unknown>
  extends React.HTMLAttributes<HTMLDivElement> {
  data: Bar<T>[];
  valueFormatter?: (value: number) => string;
  showAnimation?: boolean;
  onValueChange?: (payload: Bar<T>) => void;
  sortOrder?: 'ascending' | 'descending' | 'none';
  /** 棒の面の色クラス（既定 bg-bar）。指標ごとに色を変えるための追加プロパティ。 */
  barClassName?: string;
}

/**
 * ラベルの直後に置く読み上げ・抽出用の値（Tremor 既定には無い追加・Issue #77）。
 *
 * BarList は名前の列と値の列を**別の DOM 列**として描くため、テキストとして
 * 線形化すると「名前×10 → 値×10」の順に並び、「康熙帝（清）は61年332日」という
 * 文字列がページ上のどこにも存在しない。視覚的な位置でしか対応が取れないので、
 * 抽出側（生成エンジン・読み上げ）が対応関係を保つ保証がない。
 *
 * - **`aria-label` で足さない** — アクセシブル名を置き換えるので可視テキストが消え、
 *   WCAG 2.5.3 Label in Name 違反になる（2026-07-27 の実装で踏んだ罠）。
 *   `sr-only` の追記なら可視ラベルが名前の前方一致で残る
 * - 値の列（右側）は**そのまま残す** — 可視の内容を a11y ツリーから消さない。
 *   読み上げで値が2回出るほうが、列ごと消えるより安い
 * - `valueFormatter` を通した表示文字列を入れる。生の `item.value` を入れると、
 *   ランキングのように value が内部値（`ratio * 1_000_000`）の呼び出しで
 *   `1000000` が出る（見た目は変わらないので気づけない）
 */
function ValueForText({ value }: { value: string }) {
  return <span className="sr-only">{` ${value}`}</span>;
}

function BarListInner<T>(
  {
    data = [],
    valueFormatter = (value) => value.toString(),
    showAnimation = false,
    onValueChange,
    sortOrder = 'descending',
    barClassName = 'bg-bar',
    className,
    ...props
  }: BarListProps<T>,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const Component = onValueChange ? 'button' : 'div';
  const sortedData = React.useMemo(() => {
    if (sortOrder === 'none') {
      return data;
    }
    return [...data].sort((a, b) => {
      return sortOrder === 'ascending' ? a.value - b.value : b.value - a.value;
    });
  }, [data, sortOrder]);

  const widths = React.useMemo(() => {
    const maxValue = Math.max(...sortedData.map((item) => item.value), 0);
    return sortedData.map((item) =>
      item.value === 0 ? 0 : Math.max((item.value / maxValue) * 100, 2),
    );
  }, [sortedData]);

  const rowHeight = 'h-8';

  return (
    <div
      ref={forwardedRef}
      className={cx('flex justify-between space-x-6', className)}
      aria-sort={sortOrder}
      tremor-id="tremor-raw"
      {...props}
    >
      <div className="relative w-full space-y-1.5">
        {sortedData.map((item, index) => (
          <Component
            key={item.key ?? item.name}
            onClick={() => {
              onValueChange?.(item);
            }}
            className={cx(
              // base
              'group w-full rounded',
              // focus
              focusRing,
              onValueChange
                ? [
                    '!-m-0 cursor-pointer',
                    // hover
                    'hover:bg-muted hover:dark:bg-gray-900',
                  ]
                : '',
            )}
          >
            <div
              className={cx(
                // base
                'flex items-center rounded transition-all',
                rowHeight,
                // background color
                // 棒の面は既定で --bar（赤茶）。朱そのままだと白文字が要る＝棒が名前より
                // 短い指標で破綻し、15%の網掛けだと淡いピンクになって浮く
                // （どちらもユーザー指摘・2026-07-31）。黒文字が乗る明るさで選んである。
                // 指標ごとに変えるときは barClassName で差し替える（globals.css の --bar-*）。
                barClassName,
                onValueChange ? 'group-hover:opacity-85' : '',
                // margin and duration
                {
                  'mb-0': index === sortedData.length - 1,
                  'duration-800': showAnimation,
                },
              )}
              style={{ width: `${widths[index]}%` }}
            >
              <div className={cx('absolute left-2 flex max-w-full pr-2')}>
                {item.href ? (
                  <a
                    href={item.href}
                    className={cx(
                      // base
                      'truncate whitespace-nowrap rounded text-sm',
                      // text color
                      'text-foreground',
                      // hover
                      'hover:underline hover:underline-offset-2',
                      // focus
                      focusRing,
                    )}
                    // Tremor 既定の target="_blank" rel="noreferrer" は外してある
                    // （Issue #77・2026-08-05 ユーザー決定）。この BarList のリンク先は
                    // サイト内の皇帝個別ページだけで、新規タブを開くのは既定の巻き添え。
                    // Tremor を上げ直すときに戻さないこと。
                    onClick={(event) => event.stopPropagation()}
                  >
                    {item.name}
                    <ValueForText value={valueFormatter(item.value)} />
                  </a>
                ) : (
                  <p
                    className={cx(
                      // base
                      'truncate whitespace-nowrap text-sm',
                      // text color
                      'text-foreground',
                    )}
                  >
                    {item.name}
                    <ValueForText value={valueFormatter(item.value)} />
                  </p>
                )}
              </div>
            </div>
          </Component>
        ))}
      </div>
      <div>
        {sortedData.map((item, index) => (
          <div
            key={item.key ?? item.name}
            className={cx(
              'flex items-center justify-end',
              rowHeight,
              index === sortedData.length - 1 ? 'mb-0' : 'mb-1.5',
            )}
          >
            <p
              className={cx(
                // base
                'truncate whitespace-nowrap text-sm leading-none',
                // text color
                'text-foreground dark:text-gray-50',
              )}
            >
              {valueFormatter(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

BarListInner.displayName = 'BarList';

const BarList = React.forwardRef(BarListInner) as <T>(
  p: BarListProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof BarListInner>;

export { BarList, type BarListProps };
