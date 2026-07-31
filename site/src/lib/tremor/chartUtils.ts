// Tremor chartColors [v0.0.0]

export type ColorUtility = 'bg' | 'stroke' | 'fill' | 'text';

export const chartColors = {
  blue: {
    bg: 'bg-blue-500',
    stroke: 'stroke-blue-500',
    fill: 'fill-blue-500',
    text: 'text-blue-500',
  },
  emerald: {
    bg: 'bg-emerald-500',
    stroke: 'stroke-emerald-500',
    fill: 'fill-emerald-500',
    text: 'text-emerald-500',
  },
  violet: {
    bg: 'bg-violet-500',
    stroke: 'stroke-violet-500',
    fill: 'fill-violet-500',
    text: 'text-violet-500',
  },
  amber: {
    bg: 'bg-amber-500',
    stroke: 'stroke-amber-500',
    fill: 'fill-amber-500',
    text: 'text-amber-500',
  },
  gray: {
    bg: 'bg-gray-500',
    stroke: 'stroke-gray-500',
    fill: 'fill-gray-500',
    text: 'text-gray-500',
  },
  cyan: {
    bg: 'bg-cyan-500',
    stroke: 'stroke-cyan-500',
    fill: 'fill-cyan-500',
    text: 'text-cyan-500',
  },
  red: {
    bg: 'bg-red-500',
    stroke: 'stroke-red-500',
    fill: 'fill-red-500',
    text: 'text-red-500',
  },
  indigo: {
    bg: 'bg-indigo-500',
    stroke: 'stroke-indigo-500',
    fill: 'fill-indigo-500',
    text: 'text-indigo-500',
  },
  pink: {
    bg: 'bg-pink-500',
    stroke: 'stroke-pink-500',
    fill: 'fill-pink-500',
    text: 'text-pink-500',
  },
  purple: {
    bg: 'bg-purple-500',
    stroke: 'stroke-purple-500',
    fill: 'fill-purple-500',
    text: 'text-purple-500',
  },
  lime: {
    bg: 'bg-lime-500',
    stroke: 'stroke-lime-500',
    fill: 'fill-lime-500',
    text: 'text-lime-500',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500',
    stroke: 'stroke-fuchsia-500',
    fill: 'fill-fuchsia-500',
    text: 'text-fuchsia-500',
  },
  lightGray: {
    bg: 'bg-gray-300 dark:bg-gray-700',
    stroke: 'stroke-gray-300 dark:stroke-gray-700',
    fill: 'fill-gray-300 dark:fill-gray-700',
    text: 'text-gray-300 dark:text-gray-700',
  },
  darkGray: {
    bg: 'bg-gray-800 dark:bg-gray-200',
    stroke: 'stroke-gray-800 dark:stroke-gray-200',
    fill: 'fill-gray-800 dark:fill-gray-200',
    text: 'text-gray-800 dark:text-gray-200',
  },
  // ここから下は Tremor 由来ではなく、この site のトークン（globals.css の
  // --series-1〜8 / --seal）。パレットを差し替えると図の色も一緒に変わる。
  series1: {
    bg: 'bg-series-1',
    stroke: 'stroke-series-1',
    fill: 'fill-series-1',
    text: 'text-series-1',
  },
  series2: {
    bg: 'bg-series-2',
    stroke: 'stroke-series-2',
    fill: 'fill-series-2',
    text: 'text-series-2',
  },
  series3: {
    bg: 'bg-series-3',
    stroke: 'stroke-series-3',
    fill: 'fill-series-3',
    text: 'text-series-3',
  },
  series4: {
    bg: 'bg-series-4',
    stroke: 'stroke-series-4',
    fill: 'fill-series-4',
    text: 'text-series-4',
  },
  series5: {
    bg: 'bg-series-5',
    stroke: 'stroke-series-5',
    fill: 'fill-series-5',
    text: 'text-series-5',
  },
  series6: {
    bg: 'bg-series-6',
    stroke: 'stroke-series-6',
    fill: 'fill-series-6',
    text: 'text-series-6',
  },
  series7: {
    bg: 'bg-series-7',
    stroke: 'stroke-series-7',
    fill: 'fill-series-7',
    text: 'text-series-7',
  },
  series8: {
    bg: 'bg-series-8',
    stroke: 'stroke-series-8',
    fill: 'fill-series-8',
    text: 'text-series-8',
  },
  seal: {
    bg: 'bg-seal',
    stroke: 'stroke-seal',
    fill: 'fill-seal',
    text: 'text-seal',
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string;
  };
};

export type AvailableChartColorsKeys = keyof typeof chartColors;

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(
  chartColors,
) as Array<AvailableChartColorsKeys>;

export const constructCategoryColors = (
  categories: string[],
  colors: AvailableChartColorsKeys[],
): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>();
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]);
  });
  return categoryColors;
};

export const getColorClassName = (
  color: AvailableChartColorsKeys,
  type: ColorUtility,
): string => {
  const fallbackColor = {
    bg: 'bg-gray-500',
    stroke: 'stroke-gray-500',
    fill: 'fill-gray-500',
    text: 'text-gray-500',
  };
  return chartColors[color]?.[type] ?? fallbackColor[type];
};

// Tremor getYAxisDomain [v0.0.0]

export const getYAxisDomain = (
  autoMinValue: boolean,
  minValue: number | undefined,
  maxValue: number | undefined,
) => {
  const minDomain = autoMinValue ? 'auto' : (minValue ?? 0);
  const maxDomain = maxValue ?? 'auto';
  return [minDomain, maxDomain];
};

// Tremor hasOnlyOneValueForKey [v0.1.0]

export function hasOnlyOneValueForKey(
  array: Record<string, unknown>[],
  keyToCheck: string,
): boolean {
  const val: unknown[] = [];

  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck]);
      if (val.length > 1) {
        return false;
      }
    }
  }

  return true;
}
