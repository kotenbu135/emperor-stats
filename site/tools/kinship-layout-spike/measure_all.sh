#!/usr/bin/env bash
# 6章ぶんを続けて測る。出力は time_mock.mjs の stderr（幅・下限・重なり・横切り）だけ。
set -u
export PATH="$HOME/.nvm/versions/node/v26.4.0/bin:$PATH"
HERE="$(dirname "$0")"
OUT="${OUT:-}"
for era in qin-han three-kingdoms-jin eastern-jin-sixteen northern-southern sui-tang five-dynasties; do
  if [ -n "$OUT" ]; then
    node "$HERE/time_mock.mjs" "$era" > "$OUT/$era.html"
  else
    node "$HERE/time_mock.mjs" "$era" > /dev/null
  fi
done
