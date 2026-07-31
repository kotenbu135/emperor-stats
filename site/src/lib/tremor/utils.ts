// Tremor（tremorlabs/tremor-blocks・MIT）から取り込んだユーティリティ。
// 上流をそのまま追従する前提には立たず、このリポジトリのコードとして保守する。

import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args));
}

export const focusInput = [
  "focus:ring-2",
  "focus:ring-blue-200",
  "focus:border-blue-500",
];

export const focusRing = [
  "outline outline-offset-2 outline-0 focus-visible:outline-2",
  "outline-blue-500",
];

export const hasErrorInput = [
  "ring-2",
  "border-destructive",
  "ring-destructive/20",
];
