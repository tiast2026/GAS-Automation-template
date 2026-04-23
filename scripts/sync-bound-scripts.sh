#!/usr/bin/env bash
# .claude/bound-scripts.json を Dispatcher に同期する。
#
# SessionStart フックから自動で叩かれる想定。手動で叩いても OK。
# Dispatcher のスクリプトプロパティから登録情報が消えた場合（再デプロイ後）の
# リカバリ手段でもある。
#
# 新しい Dispatcher には bulkRegisterBoundScripts エンドポイントがあり、
# それがあればそちらを使う。無ければ個別 registerBoundScript にフォールバック。

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
MAP_FILE="$REPO_ROOT/.claude/bound-scripts.json"

if [ ! -f "$MAP_FILE" ]; then
  exit 0
fi

ENTRIES=$(jq -c '.entries // {}' "$MAP_FILE")
COUNT=$(echo "$ENTRIES" | jq 'length')

if [ "$COUNT" -eq 0 ]; then
  exit 0
fi

echo "[sync-bound-scripts] syncing $COUNT entries..."

# まず bulkRegisterBoundScripts を試す（新 Dispatcher 用）
BULK=$("$HERE/call-dispatcher.sh" bulkRegisterBoundScripts "{\"entries\":$ENTRIES}" 2>/dev/null || echo '{"ok":false}')

if echo "$BULK" | jq -e '.ok == true' >/dev/null; then
  REG=$(echo "$BULK" | jq -r '.result.registered | length')
  SKIP=$(echo "$BULK" | jq -r '.result.skipped | length')
  FAIL=$(echo "$BULK" | jq -r '.result.failed | length')
  echo "[sync-bound-scripts] done (bulk): registered=$REG skipped=$SKIP failed=$FAIL"
  [ "$FAIL" -gt 0 ] && echo "$BULK" | jq '.result.failed' >&2
  exit 0
fi

# フォールバック: 個別呼び出し（旧 Dispatcher 用）
echo "[sync-bound-scripts] bulk endpoint unavailable, falling back to individual calls"
REG=0; SKIP=0; FAIL=0
for SHEET_ID in $(echo "$ENTRIES" | jq -r 'keys[]'); do
  SCRIPT_ID=$(echo "$ENTRIES" | jq -r --arg s "$SHEET_ID" '.[$s]')
  RESP=$("$HERE/call-dispatcher.sh" registerBoundScript \
    "{\"sheetId\":\"$SHEET_ID\",\"scriptId\":\"$SCRIPT_ID\"}" 2>/dev/null || echo '{"ok":false}')
  if echo "$RESP" | jq -e '.ok == true' >/dev/null; then
    if echo "$RESP" | jq -e '.result.previous == $s' --arg s "$SCRIPT_ID" >/dev/null; then
      SKIP=$((SKIP + 1))
    else
      REG=$((REG + 1))
    fi
  else
    FAIL=$((FAIL + 1))
    echo "[sync-bound-scripts] failed: $SHEET_ID → $(echo "$RESP" | jq -r '.error // "unknown"')" >&2
  fi
done
echo "[sync-bound-scripts] done (individual): registered=$REG skipped=$SKIP failed=$FAIL"
