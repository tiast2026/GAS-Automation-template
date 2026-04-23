#!/usr/bin/env bash
# シート ↔ コンテナバインド GAS の紐付けを登録するヘルパー。
#
# 新規シートの GAS を初めて触るときに 1 回だけ叩く。
#
# Usage:
#   scripts/register-sheet-script.sh <sheet-url-or-id> <apps-script-url-or-id>
#
# Examples:
#   scripts/register-sheet-script.sh \
#     https://docs.google.com/spreadsheets/d/1AbC.../edit \
#     https://script.google.com/u/2/home/projects/1XyZ.../edit
#
# 挙動:
#   1. Dispatcher に registerBoundScript を叩く（URL のまま投げられる）
#   2. 成功したら .claude/bound-scripts.json に追記
#   3. 次セッション以降は自動同期される

set -euo pipefail

if [ $# -lt 2 ]; then
  cat >&2 <<USAGE
Usage: $0 <sheet-url-or-id> <apps-script-url-or-id>

Example:
  $0 https://docs.google.com/spreadsheets/d/1AbC.../edit \\
     https://script.google.com/u/2/home/projects/1XyZ.../edit
USAGE
  exit 1
fi

SHEET_INPUT="$1"
SCRIPT_INPUT="$2"

# URL / ID どちらも受け付ける
extract_sheet_id() {
  if [[ "$1" =~ /spreadsheets/d/([a-zA-Z0-9_-]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "$1"
  fi
}

extract_script_id() {
  if [[ "$1" =~ /projects/([a-zA-Z0-9_-]{20,}) ]]; then
    echo "${BASH_REMATCH[1]}"
  elif [[ "$1" =~ /d/([a-zA-Z0-9_-]{40,}) ]]; then
    echo "${BASH_REMATCH[1]}"
  elif [[ "$1" =~ /macros/s/([a-zA-Z0-9_-]+) ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "$1"
  fi
}

SHEET_ID=$(extract_sheet_id "$SHEET_INPUT")
SCRIPT_ID=$(extract_script_id "$SCRIPT_INPUT")

if [ -z "$SHEET_ID" ] || [ -z "$SCRIPT_ID" ]; then
  echo "[register-sheet-script] failed to parse IDs" >&2
  echo "  sheet input:  $SHEET_INPUT" >&2
  echo "  script input: $SCRIPT_INPUT" >&2
  exit 1
fi

echo "[register-sheet-script] sheetId=$SHEET_ID scriptId=$SCRIPT_ID"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
MAP_FILE="$REPO_ROOT/.claude/bound-scripts.json"

# 1. Dispatcher に登録
echo "[register-sheet-script] calling Dispatcher..."
RESULT=$("$HERE/call-dispatcher.sh" registerBoundScript \
  "{\"sheetId\":\"$SHEET_ID\",\"scriptId\":\"$SCRIPT_ID\"}")
echo "$RESULT" | jq .

if ! echo "$RESULT" | jq -e '.ok == true' >/dev/null; then
  echo "[register-sheet-script] Dispatcher refused the registration" >&2
  exit 1
fi

# 2. ローカル JSON にも追記
if [ ! -f "$MAP_FILE" ]; then
  echo '{"entries":{}}' > "$MAP_FILE"
fi

TMP=$(mktemp)
jq --arg s "$SHEET_ID" --arg p "$SCRIPT_ID" '.entries[$s] = $p' "$MAP_FILE" > "$TMP"
mv "$TMP" "$MAP_FILE"

echo "[register-sheet-script] updated $MAP_FILE"
echo "[register-sheet-script] done. 変更をコミットして push すると、他のセッションでも自動同期されます:"
echo "    git add .claude/bound-scripts.json && git commit -m \"Register bound script for \$SHEET_ID\" && git push"
