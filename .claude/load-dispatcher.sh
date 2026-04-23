#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: Dispatcher GAS の接続情報を Claude Code にロードする
#
# 優先順位:
#   1. .claude/gas-dispatcher.local.json  (gitignore 済み、個人の上書き用)
#   2. .claude/gas-dispatcher.json        (コミット版、チーム共有用)
#
# どちらも存在しない場合はセットアップ手順への誘導ログのみ出して終了する。

LOCAL_FILE=".claude/gas-dispatcher.local.json"
SHARED_FILE=".claude/gas-dispatcher.json"

if [ -f "$LOCAL_FILE" ]; then
  CONFIG_FILE="$LOCAL_FILE"
elif [ -f "$SHARED_FILE" ]; then
  CONFIG_FILE="$SHARED_FILE"
else
  cat <<'MSG'
[gas-dispatcher] not configured (missing .claude/gas-dispatcher.json)
See https://gas-automation.vercel.app/guide/02-setup for the 5-minute setup.
MSG
  exit 0
fi

if command -v jq >/dev/null 2>&1; then
  URL=$(jq -r '.url // empty' "$CONFIG_FILE")
  TOKEN_LEN=$(jq -r '.token // empty' "$CONFIG_FILE" | wc -c | tr -d ' ')
else
  # jq がない環境向けの雑 fallback (値にエスケープ済みの " が混ざっていない前提)
  URL=$(grep -oE '"url"[[:space:]]*:[[:space:]]*"[^"]+"' "$CONFIG_FILE" | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
  TOKEN_LEN=$(grep -oE '"token"[[:space:]]*:[[:space:]]*"[^"]+"' "$CONFIG_FILE" | head -1 | sed -E 's/.*"([^"]+)"$/\1/' | wc -c | tr -d ' ')
fi

if [ -z "$URL" ]; then
  echo "[gas-dispatcher] config found at $CONFIG_FILE but 'url' is missing"
  exit 0
fi

echo "[gas-dispatcher] loaded from $CONFIG_FILE url=$URL token=<${TOKEN_LEN} chars>"
