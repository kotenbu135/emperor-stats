#!/usr/bin/env bash
# worktree の作業場所を primary と揃える。
#
#   scripts/setup_worktree.sh [--site] [--quiet] [<worktree のパス>]
#   scripts/setup_worktree.sh --from-hook        # stdin の PostToolUse ペイロードから対象を取る
#
# 揃えるもの:
#   1. コーパス4本（china-history / daizhigev20 / _corpus_cache / _norm_cache）を primary へ symlink
#      → 無いとコーパス依存のゲート（verify_quotes など）が「黙って」スキップされる
#   2. --site: site/node_modules を primary から `cp -al` でハードリンク複製
#      → symlink だと Turbopack が "Symlink [project]/node_modules is invalid, it points out
#        of the filesystem root" で拒否する。ハードリンク複製なら通る（約0.5秒・実ディスクはほぼ0）
#
# 何度流しても安全（既にあるものは触らない）。対象が worktree でなければ何もしない。
set -euo pipefail

CORPUS_DIRS=(china-history daizhigev20 _corpus_cache _norm_cache)

want_site=0
quiet=0
from_hook=0
target=""

while [ $# -gt 0 ]; do
  case "$1" in
    --site) want_site=1 ;;
    --quiet) quiet=1 ;;
    --from-hook) from_hook=1; quiet=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) target="$1" ;;
  esac
  shift
done

say() { [ "$quiet" = 1 ] || printf '%s\n' "$*"; }

if [ "$from_hook" = 1 ]; then
  target="$(python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print((d.get("tool_response") or {}).get("worktreePath") or d.get("cwd") or "")
' 2>/dev/null || true)"
  [ -n "$target" ] || exit 0
fi

[ -n "$target" ] || target="$(pwd)"
[ -d "$target" ] || exit 0
target="$(cd "$target" && pwd -P)"
# site/ の中から流されても作業場所の根へ寄せる（AGENTS.md の復旧手順がその位置から呼ぶ）
target="$(git -C "$target" rev-parse --show-toplevel 2>/dev/null || echo "$target")"

# primary（共有 .git を持つ側）の場所
common_dir="$(git -C "$target" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
[ -n "$common_dir" ] || exit 0
primary="$(dirname "$common_dir")"

# primary 自身なら何もしない
[ "$target" != "$primary" ] || exit 0

linked=()
for d in "${CORPUS_DIRS[@]}"; do
  [ -d "$primary/$d" ] || continue          # primary にも無いものは作らない
  [ ! -e "$target/$d" ] || continue         # 既にある（実体でも symlink でも）なら触らない
  ln -s "$primary/$d" "$target/$d"
  linked+=("$d")
done
[ ${#linked[@]} -eq 0 ] || say "コーパスを symlink: ${linked[*]}"

if [ "$want_site" = 1 ]; then
  src="$primary/site/node_modules"
  dst="$target/site/node_modules"
  if [ ! -d "$src" ]; then
    say "primary に site/node_modules が無いので複製しない（先に primary で npm install）"
  elif [ -L "$dst" ]; then
    # symlink は Turbopack が拒否する。ハードリンク複製へ置き換える
    rm "$dst"
    cp -al "$src" "$dst"
    say "site/node_modules: symlink をハードリンク複製へ置き換えた"
  elif [ -d "$dst" ]; then
    say "site/node_modules: 既にある（触らない）"
  else
    cp -al "$src" "$dst"
    say "site/node_modules: primary からハードリンク複製した"
  fi
fi
