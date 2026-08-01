#!/usr/bin/env bash
# SessionStart フック: セッション冒頭に「いまどこで・どのブランチで作業しようとしているか」を報告する。
#
# 目的: 別セッションが primary（/home/sakis/emperor-stats）を自分のブランチに切り替えたまま
# 作業している状態で新規セッションを立ち上げると、そのブランチの上にコミットしてしまう事故が
# 起きていた（2026-08-02）。起動時に必ず現在地・ブランチ・他 worktree の占有状況を出す。
#
# 出力は JSON。additionalContext がモデルの文脈へ、systemMessage が端末へ出る。
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

MAIN_BRANCH=main

here=$(pwd -P)
branch=$(git branch --show-current 2>/dev/null)
[ -n "$branch" ] || branch="(detached HEAD)"

# primary（本体）の作業ツリーは worktree list の先頭
primary=$(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0,10); exit}')
if [ "$here" = "$primary" ]; then
  place="primary"
else
  place="worktree: $(basename "$here")"
fi

dirty=$(git status --porcelain -- . ':(exclude).claude/' 2>/dev/null | wc -l | tr -d ' ')

ahead_behind=""
if git rev-parse --verify --quiet "$MAIN_BRANCH" >/dev/null 2>&1; then
  read -r ahead behind <<<"$(git rev-list --left-right --count "HEAD...$MAIN_BRANCH" 2>/dev/null)"
  ahead_behind="${ahead:-?} 先行 / ${behind:-?} 遅れ"
fi

out=""
add() { out="${out}${1}"$'\n'; }

add "[作業場所] ${here} （${place}）"
if [ "$branch" = "$MAIN_BRANCH" ]; then
  add "[ブランチ] ${branch}"
else
  add "[ブランチ] ${branch}  ← ${MAIN_BRANCH} ではありません"
fi
[ -n "$ahead_behind" ] && add "[${MAIN_BRANCH} との差] ${ahead_behind}"
if [ "$dirty" = "0" ]; then
  add "[未コミット] なし"
else
  add "[未コミット] ${dirty} 件（他セッションが編集中の可能性）"
fi

add ""
add "[worktree 一覧（primary 以外は他セッションの作業場所とみなす）]"
while IFS= read -r line; do
  wt=${line%% *}
  [ -d "$wt" ] || continue
  wb=$(git -C "$wt" branch --show-current 2>/dev/null)
  wd=$(git -C "$wt" status --porcelain -- . ':(exclude).claude/' 2>/dev/null | wc -l | tr -d ' ')
  wl=$(git -C "$wt" log -1 --format=%cd --date=format:'%m-%d %H:%M' 2>/dev/null)
  mark=" "
  [ "$wt" = "$here" ] && mark="*"
  if [ "$wt" = "$primary" ]; then
    name="(primary)"
  else
    name=${wt#"$primary"/}
    name=${name#.claude/worktrees/}
  fi
  if [ "$wd" = "0" ]; then st="clean"; else st="未コミット ${wd} 件"; fi
  add "$(printf '%s %-20s %-32s %s  %s' "$mark" "$name" "${wb:-(detached)}" "$wl" "$st")"
done < <(git worktree list 2>/dev/null)

add ""
if [ "$place" = "primary" ] && [ "$branch" != "$MAIN_BRANCH" ]; then
  add "[!] primary が ${MAIN_BRANCH} ではありません。このブランチは別セッションの作業中とみなしてください。"
  add "    - このブランチにコミット・push しない（そのセッションの作業を巻き込みます）"
  add "    - 新しい作業を始めるなら primary で切り替えず、EnterWorktree で自分専用の worktree を作る"
  add "    - どうしても primary のこのブランチで作業する必要があるなら、先にユーザーへ確認する"
else
  add "[運用] 新しい作業は EnterWorktree で自分専用の worktree を作って行い、primary は ${MAIN_BRANCH} に置いたままにする。"
  add "       コミット前に必ず 'git status -sb' でブランチを確認する。"
fi

msg="作業場所: ${place} / ブランチ: ${branch}"
if [ "$place" = "primary" ] && [ "$branch" != "$MAIN_BRANCH" ]; then
  msg="⚠ primary が ${MAIN_BRANCH} ではありません（${branch}）— 別セッションの作業中の可能性"
fi

if command -v jq >/dev/null 2>&1; then
  printf '%s' "$out" | jq -Rs --arg msg "$msg" \
    '{systemMessage:$msg, hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:.}}'
else
  printf '%s' "$out"
fi
