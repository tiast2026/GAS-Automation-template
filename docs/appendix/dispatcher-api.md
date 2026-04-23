---
prev:
  text: 'A: 旧 clasp 方式について'
  link: '/appendix/legacy-clasp'
next:
  text: 'C: セキュリティ詳細'
  link: '/appendix/security'
---

# 付録 B: Dispatcher API リファレンス

窓口 GAS（`scripts/_dispatcher/Code.gs`）が提供する全エンドポイントの仕様です。

Claude Code は通常この一覧を暗黙に把握して勝手に呼び出しますが、自分で直接 `curl` でデバッグしたいときや、Dispatcher に新エンドポイントを追加したいときの参考に使ってください。

## 共通仕様

- **メソッド**: POST
- **URL**: Deploy で発行された `https://script.google.com/macros/s/.../exec`
- **Content-Type**: `application/json`
- **全リクエストに `token` フィールド必須**
- **レスポンス形式**:

```json
{ "ok": true,  "result": ... }
{ "ok": false, "error": "...", "stack": "..." }
```

## 呼び出し方

### 推奨: ヘルパースクリプト

リポジトリ同梱の `scripts/call-dispatcher.sh` を使うのが最も安全です。curl のリダイレクト挙動に関する落とし穴を全て吸収します。

```bash
bash scripts/call-dispatcher.sh ping
bash scripts/call-dispatcher.sh listTabs '{"sheetId":"..."}'
bash scripts/call-dispatcher.sh readCell '{"sheetId":"...","a1":"A2"}'
```

環境変数 `GAS_DISPATCHER_URL` / `GAS_DISPATCHER_TOKEN` が未設定なら `.claude/gas-dispatcher.json` を自動で読み込みます。

### 手書きする場合の curl

```bash
curl -sL \
  -H 'Content-Type: application/json' \
  -d '{"action":"ping","token":"'"$GAS_DISPATCHER_TOKEN"'"}' \
  "$GAS_DISPATCHER_URL"
```

::: warning `-X POST` を明示しない
Apps Script は POST を 302 で `script.googleusercontent.com/macros/echo` にリダイレクトし、リダイレクト先は **GET で取りに行くのが正しい挙動** です。`-X POST` を付けると curl がリダイレクト先にも POST してしまい、Google Drive の「Sorry, unable to open the file at this time.」が返ってきます。`-d` だけ付けていれば curl が初回 POST・リダイレクト後 GET と適切に振る舞うので、`-X POST` は書かないでください。
:::

### Node / Python / UrlFetchApp を使う場合

これらの HTTP クライアントは POST → 302 リダイレクト時にメソッドを GET に切り替えない実装が多く、同じトラップにハマります。

- **Node `fetch` / `axios`**: デフォルトで POST のまま追う。`redirect: 'manual'` で 302 を自前処理するか、GET で取り直す
- **Python `requests`**: 302 時に GET に変わるので問題なし
- **Apps Script `UrlFetchApp.fetch`**: `followRedirects: false` にして Location をパース、GET で再取得

curl が使える環境なら、迷わずヘルパースクリプト経由が一番安全です。

---

## 動作確認系

### `ping`

疎通確認。追加パラメータなし。

**返り値:**

```json
{
  "pong": true,
  "email": "you@example.com",
  "timeZone": "Asia/Tokyo"
}
```

---

## 読み取り系

### `listTabs`

タブ一覧と各行数・列数。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | スプレッドシート ID |

**返り値:** `[{ name, rows, cols }, ...]`

### `readTab`

タブの中身を 2 次元配列で取得。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | |
| `tab` | 任意 | 省略時は先頭タブ |
| `range` | 任意 | A1 記法。省略時は `getDataRange()` |

**返り値:** `[[...], [...], ...]`

### `readCell`

単一セル値。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | |
| `tab` | 任意 | |
| `a1` | ✅ | 例: `"A2"` |

**返り値:** プリミティブ値

### `describeTab`

タブのメタ情報（行・列数、ヘッダー行）。

| フィールド | 必須 |
|---|---|
| `sheetId` | ✅ |
| `tab` | ✅ |

**返り値:** `{ name, rows, cols, headers }`

---

## 書き込み系

### `writeRange`

範囲に値を書き込む。タブがなければ作成。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | |
| `tab` | ✅ | |
| `a1` | ✅ | 起点セル（例 `"A1"`）|
| `values` | ✅ | 2 次元配列 |

**返り値:** `{ rows, cols }`

### `appendRows`

末尾行に追加。

| フィールド | 必須 |
|---|---|
| `sheetId` | ✅ |
| `tab` | ✅ |
| `values` | ✅ |

**返り値:** `{ appended }`

### `createTab`

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | |
| `name` | ✅ | |
| `index` | 任意 | 挿入位置（0 始まり）|

### `clearTab`

タブの中身を全消去（書式は残る）。 **破壊的操作** 。事前確認推奨。

| フィールド | 必須 |
|---|---|
| `sheetId` | ✅ |
| `tab` | ✅ |

### `renameTab`

| フィールド | 必須 |
|---|---|
| `sheetId` | ✅ |
| `oldName` | ✅ |
| `newName` | ✅ |

---

## 任意コード実行

### `runScript`

Claude が生成した GAS コードをその場で実行（保存しない）。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | 任意 | 指定すると `ss` が事前バインドされる |
| `code` | ✅ | 実行するコード本体（関数本体に相当）|

`code` 内で使える変数・モジュール:

- `ss` — `SpreadsheetApp.openById(sheetId)` の結果
- `SpreadsheetApp`, `DriveApp`, `Logger`, `Utilities`, `UrlFetchApp`, `PropertiesService`

`return` した値がレスポンスの `result` になります。

**例:**

```js
const sheet = ss.getSheetByName('抽出');
const data = sheet.getDataRange().getValues();
return { rowCount: data.length - 1 };
```

---

## コンテナバインド GAS 管理

対象シートの「拡張機能 → Apps Script」に常駐するコードを API 経由で読み書きします。

### マッピングの考え方

窓口 GAS は内部に **sheetId ↔ scriptId の対応表** を持ちます（スクリプトプロパティ `BOUND_SCRIPTS`）。

- 既存のコンテナバインド GAS を触りたい → まず `registerBoundScript` で登録
- 新規に作ってほしい → 各エンドポイントで `autoCreate: true` を明示

デフォルトは **未登録のシートに対する新規作成を拒否** する安全側の挙動です。

### `registerBoundScript`

既存のコンテナバインド GAS をマッピングに登録。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | |
| `scriptId` | ✅ | 対象シートを開いて「拡張機能 → Apps Script」→ URL の `/projects/<ここ>/edit` |

Apps Script API でスクリプト情報を取得し、`parentId` が `sheetId` と一致するか検証してから登録します。別シートのスクリプトを誤登録できません。

**返り値:** `{ sheetId, scriptId, previous, title }`

### `listBoundScripts`

現在登録されているマッピング一覧。

**返り値:** `{ [sheetId]: scriptId }`

### `unregisterBoundScript`

マッピングから削除（スクリプトや GAS 本体は消さない、紐付けの解除のみ）。

| フィールド | 必須 |
|---|---|
| `sheetId` | ✅ |

### `getBoundScript`

対象シートのコンテナバインド GAS を取得。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | |
| `autoCreate` | 任意 | `true` なら未登録時に新規作成（空 + デフォルトマニフェスト）|

**返り値:**

```json
{
  "scriptId": "...",
  "files": [
    { "name": "appsscript", "type": "JSON",      "source": "..." },
    { "name": "Code",       "type": "SERVER_JS", "source": "..." }
  ]
}
```

### `writeBoundScript`

コンテナバインド GAS のファイル群を書き換え（全置換）。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | |
| `files` | ✅ | `[{ name, type, source }, ...]`<br>`type`: `"SERVER_JS"` / `"JSON"` / `"HTML"` |
| `autoCreate` | 任意 | `true` なら未登録時に新規作成 |

`appsscript` マニフェストを含めなかった場合は自動で最小構成を追加します。

**返り値:** `{ scriptId, files: [{ name, type }] }`

---

## トリガー管理

### `installTimeTrigger`

時間ベースのトリガーを窓口 GAS 自身に仕込む。発火時に指定した `job` が実行される。

| フィールド | 必須 | 説明 |
|---|---|---|
| `when` | ✅ | 下記参照 |
| `job` | 任意 | 実行内容（下記参照）|
| `handlerName` | 任意 | デフォルト `dispatchScheduledJob` |

**`when` の形式:**

```json
{ "type": "daily",          "hour": 9 }
{ "type": "weekly",         "weekday": "MONDAY", "hour": 9 }
{ "type": "hourly",         "hours": 1 }
{ "type": "every_minutes",  "minutes": 5 }
```

**`job` の形式（現状 `runScript` のみ対応）:**

```json
{ "action": "runScript", "sheetId": "...", "code": "..." }
```

**返り値:** `{ triggerId, handlerFunction }`

### `installSheetTrigger`

対象シートの編集 / 変更 / フォーム送信 / 開封イベントに反応するトリガー。

| フィールド | 必須 | 説明 |
|---|---|---|
| `sheetId` | ✅ | 監視対象 |
| `eventType` | ✅ | `onEdit` / `onChange` / `onFormSubmit` / `onOpen` |
| `job` | 任意 | 同上 |
| `handlerName` | 任意 | デフォルト `dispatchSheetJob` |

### `listTriggers`

現在有効な全トリガー。

**返り値:** `[{ id, handlerFunction, eventType, job }, ...]`

### `deleteTrigger`

| フィールド | 必須 |
|---|---|
| `triggerId` | ✅ |

---

## エラー時の挙動

- `unauthorized` — token 不一致
- `unknown action: X` — 未定義エンドポイント
- `tab not found: X` — タブ名誤り
- `create bound project failed` — Apps Script API が OFF、または scope 不足
- その他は GAS の例外メッセージがそのまま `error` に入る

---

## Claude の使い方（内部）

`CLAUDE.md` のワークフローに沿って、Claude は以下の順で呼び出します。

1. `listTabs` でシート構造を把握
2. `describeTab` / `readTab` でデータ内容を理解
3. 必要に応じて `runScript`（使い捨て）or `writeBoundScript`（保存）
4. エラー時は `runScript` の例外メッセージから自動修正して再実行
5. 破壊的操作（`clearTab`, `deleteTrigger`, 大規模書き換え）は **事前確認** を必須とする
