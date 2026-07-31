// Tremor CategoryBar [v0.0.1]

'use client';

import React from 'react';

import {
  AvailableChartColors,
  AvailableChartColorsKeys,
  getColorClassName,
} from '@/lib/tremor/chartUtils';
import { cx } from '@/lib/tremor/utils';

import { Tooltip } from './Tooltip';

const getMarkerBgColor = (
  marker: number | undefined,
  values: number[],
  colors: AvailableChartColorsKeys[],
): string => {
  if (marker === undefined) return '';

  if (marker === 0) {
    for (let index = 0; index < values.length; index++) {
      if (values[index] > 0) {
        return getColorClassName(colors[index], 'bg');
      }
    }
  }

  let prefixSum = 0;
  for (let index = 0; index < values.length; index++) {
    prefixSum += values[index];
    if (prefixSum >= marker) {
      return getColorClassName(colors[index], 'bg');
    }
  }

  return getColorClassName(colors[values.length - 1], 'bg');
};

const getPositionLeft = (
  value: number | undefined,
  maxValue: number,
): number => (value ? (value / maxValue) * 100 : 0);

const sumNumericArray = (arr: number[]) =>
  arr.reduce((prefixSum, num) => prefixSum + num, 0);

const BarLabels = ({ values }: { values: number[] }) => {
  const sumValues = React.useMemo(() => sumNumericArray(values), [values]);
  // 累積和と「連続して隠したラベルの合計」は、描画の途中で外側の let を
  // 書き換えるのではなく先に一度で求める（描画中の変数再代入は React 19 の
  // lint が拒否する。表示結果は元の実装と同じ）。
  const labels = React.useMemo(
    () =>
      values.reduce<
        {
          showLabel: boolean;
          prefixSum: number;
          width: number;
          hiddenRun: number;
        }[]
      >((acc, widthPercentage) => {
        const prev = acc[acc.length - 1];
        const prefixSum = (prev?.prefixSum ?? 0) + widthPercentage;
        const hidden = prev
          ? prev.showLabel
            ? 0
            : (prev.hiddenRun ?? 0)
          : 0;
        const showLabel =
          (widthPercentage >= 0.1 * sumValues || hidden >= 0.09 * sumValues) &&
          sumValues - prefixSum >= 0.1 * sumValues &&
          prefixSum >= 0.1 * sumValues &&
          prefixSum < 0.9 * sumValues;
        acc.push({
          showLabel,
          prefixSum,
          width: getPositionLeft(widthPercentage, sumValues),
          hiddenRun: showLabel ? 0 : hidden + widthPercentage,
        });
        return acc;
      }, []),
    [values, sumValues],
  );

  return (
    <div
      className={cx(
        // base
        'relative mb-2 flex h-5 w-full text-sm font-medium',
        // text color
        'text-foreground',
      )}
    >
      {labels.map((label, index) => (
        <div
          key={`item-${index}`}
          className="flex items-center justify-end pr-0.5"
          style={{ width: `${label.width}%` }}
        >
          <span
            className={cx(
              label.showLabel ? 'block' : 'hidden',
              'translate-x-1/2 text-sm tabular-nums',
            )}
          >
            {label.prefixSum}
          </span>
        </div>
      ))}
      <div className="absolute bottom-0 left-0 flex items-center">0</div>
      <div className="absolute bottom-0 right-0 flex items-center">
        {sumValues}
      </div>
    </div>
  );
};

interface CategoryBarProps extends React.HTMLAttributes<HTMLDivElement> {
  values: number[];
  colors?: AvailableChartColorsKeys[];
  marker?: { value: number; tooltip?: string; showAnimation?: boolean };
  showLabels?: boolean;
}

const CategoryBar = React.forwardRef<HTMLDivElement, CategoryBarProps>(
  (
    {
      values = [],
      colors = AvailableChartColors,
      marker,
      showLabels = true,
      className,
      ...props
    },
    forwardedRef,
  ) => {
    const markerBgColor = React.useMemo(
      () => getMarkerBgColor(marker?.value, values, colors),
      [marker, values, colors],
    );

    const maxValue = React.useMemo(() => sumNumericArray(values), [values]);

    const adjustedMarkerValue = React.useMemo(() => {
      if (marker === undefined) return undefined;
      if (marker.value < 0) return 0;
      if (marker.value > maxValue) return maxValue;
      return marker.value;
    }, [marker, maxValue]);

    const markerPositionLeft: number = React.useMemo(
      () => getPositionLeft(adjustedMarkerValue, maxValue),
      [adjustedMarkerValue, maxValue],
    );

    return (
      <div
        ref={forwardedRef}
        className={cx(className)}
        aria-label="category bar"
        aria-valuenow={marker?.value}
        tremor-id="tremor-raw"
        {...props}
      >
        {showLabels ? <BarLabels values={values} /> : null}
        <div className="relative flex h-2 w-full items-center">
          <div className="flex h-full flex-1 items-center gap-0.5 overflow-hidden rounded-full">
            {values.map((value, index) => {
              const barColor = colors[index] ?? 'gray';
              const percentage = (value / maxValue) * 100;
              return (
                <div
                  key={`item-${index}`}
                  className={cx(
                    'h-full',
                    getColorClassName(
                      barColor as AvailableChartColorsKeys,
                      'bg',
                    ),
                    percentage === 0 && 'hidden',
                  )}
                  style={{ width: `${percentage}%` }}
                />
              );
            })}
          </div>

          {marker !== undefined ? (
            <div
              className={cx(
                'absolute w-2 -translate-x-1/2',
                marker.showAnimation &&
                  'transform-gpu transition-all duration-300 ease-in-out',
              )}
              style={{
                left: `${markerPositionLeft}%`,
              }}
            >
              {marker.tooltip ? (
                <Tooltip triggerAsChild content={marker.tooltip}>
                  <div
                    aria-hidden="true"
                    className={cx(
                      'relative mx-auto h-4 w-1 rounded-full ring-2',
                      'ring-white dark:ring-gray-950',
                      markerBgColor,
                    )}
                  >
                    <div
                      aria-hidden
                      className="absolute size-7 -translate-x-[45%] -translate-y-[15%]"
                    ></div>
                  </div>
                </Tooltip>
              ) : (
                <div
                  className={cx(
                    'mx-auto h-4 w-1 rounded-full ring-2',
                    'ring-white dark:ring-gray-950',
                    markerBgColor,
                  )}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);

CategoryBar.displayName = 'CategoryBar';

export { CategoryBar, type CategoryBarProps };
