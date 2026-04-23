#!/usr/bin/env bash
# Dispatcher 呼び出し用ヘルパー。
#
# 他の HTTP クライアント（Node fetch / axios / UrlFetchApp 等）は
# Apps Script の POST → 302 リダイレクト挙動で壊れがちなので、
# Dispatcher を叩くときは **必ずこのスクリプト経由** にする。
#
# Usage:
#   scripts/call-dispatcher.sh <action> [json_object]
#
# Examples:
#   scripts/call-dispatcher.sh ping
#   scripts/call-dispatcher.sh listTabs     '{"sheetId":"1AbC..."}'
#   scripts/call-dispatcher.sh readCell     '{"sheetId":"1AbC...","a1":"A2"}'
#   scripts/call-dispatcher.sh runScript    '{"sheetId":"1AbC...","code":"return ss.getName();"}'

set -euo pipefail

if [ -z "${GAS_DISPATCHER_URL:-}" ] || [ -z "${GAS_DISPATCHER_TOKEN:-}" ]; then
  CONFIG=.claude/gas-dispatcher.local.json
  [ -f "$CONFIG" ] || CONFIG=.claude/gas-dispatcher.json
  if [ -f "$CONFIG" ]; then
    GAS_DISPATCHER_URL=$(jq -r .url "$CONFIG")
    GAS_DISPATCHER_TOKEN=$(jq -r .token "$CONFIG")
  else
    echo "[call-dispatcher] GAS_DISPATCHER_URL/TOKEN not set and .claude/gas-dispatcher.json not found" >&2
    exit 1
  fi
fi

ACTION="${1:?action name required as first arg}"
EXTRA="${2-}"
[ -z "$EXTRA" ] && EXTRA='{}'

BODY=$(printf '%s' "$EXTRA" \
  | jq -c --arg action "$ACTION" --arg token "$GAS_DISPATCHER_TOKEN" \
      '. + {action: $action, token: $token}')

# 重要:
#   - `-X POST` は絶対に付けない。Apps Script は POST を 302 で
#     script.googleusercontent.com/macros/echo にリダイレクトするため、
#     リダイレクト先は **GET で取りに行く** のが正しい挙動。
#     `-X POST` を明示すると curl がリダイレクト先にも POST してしまい
#     Google Drive の "Sorry, unable to open the file" が返る。
#   - `-d` だけ付けていれば curl は初回 POST、リダイレクト後 GET と
#     適切に振る舞う。
exec curl -sL \
  -H 'Content-Type: application/json' \
  -d "$BODY" \
  "$GAS_DISPATCHER_URL"
