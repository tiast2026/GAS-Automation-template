# 付録 B: Dispatcher API リファレンス

Dispatcher GAS が公開するエンドポイントの一覧です。通常は Claude Code が自動的に適切なエンドポイントを選ぶので、このページを直接読んで手動実行する場面は多くありません。ただし、トラブル時に Claude Code が叩いている API を理解したいときや、自前スクリプトから Dispatcher を利用したいときはこのページが役立ちます。

## 共通仕様

### エンドポイント

```
POST https://script.google.com/macros/s/<DEPLOY_ID>/exec
Content-Type: application/json
```

`GET` は受け付けません（ブラウザで URL を開くとエラー HTML が返ります）。

### リクエストボディ（共通）

```json
{
  "token": "<SECRET_TOKEN>",
  "action": "<アクション名>",
  "params": { ... }
}
```

| フィールド | 必須 | 内容 |
|---|---|---|
| `token` | ✅ | スクリプトプロパティ `SECRET_TOKEN` と一致する文字列 |
| `action` | ✅ | 後述のアクション名 |
| `params` | アクションに依存 | アクション固有のパラメータ |

### レスポンス（共通）

成功時:

```json
{ "ok": true, "result": { ... } }
```

失敗時:

```json
{ "ok": false, "error": { "code": "<CODE>", "message": "<詳細>" } }
```

### 代表的なエラーコード

| `code` | 意味 |
|---|---|
| `UNAUTHORIZED` | `token` が不一致 |
| `BAD_REQUEST` | `action` 不明、または `params` が不足・型違い |
| `NOT_FOUND` | 対象のシート・タブ・関数が見つからない |
| `PERMISSION_DENIED` | Dispatcher 実行ユーザーに権限がない |
| `TIMEOUT` | 6 分制限の超過 |
| `INTERNAL_ERROR` | 内部例外（`error.message` にスタックトレース） |

---

## 読み取り系

### `ping`

生存確認。

**params**: なし

**response.result**

```json
{ "pong": true, "ts": "2026-04-23T00:00:00Z" }
```

### `listTabs`

対象スプレッドシートのタブ名一覧。

**params**

```json
{ "url": "<シート URL>" }
```

**response.result**

```json
{ "tabs": ["売上", "在庫", "マスタ"] }
```

### `readTab`

タブ全体の値を 2 次元配列で取得。

**params**

```json
{ "url": "<シート URL>", "tab": "売上", "range": "A1:Z" }
```

- `range` は省略可（省略時はデータ範囲全体）

**response.result**

```json
{ "values": [["header1", "header2"], ["row1-1", "row1-2"]] }
```

### `readCell`

単一セルの値。

**params**

```json
{ "url": "<シート URL>", "tab": "売上", "cell": "A1" }
```

**response.result**

```json
{ "value": "任意" }
```

### `describeTab`

タブの構造（行数・列数・ヘッダー行）を要約取得。

**params**

```json
{ "url": "<シート URL>", "tab": "売上" }
```

**response.result**

```json
{
  "rows": 1234,
  "cols": 12,
  "headers": ["日付", "商品", "金額", "..."]
}
```

---

## 書き込み系

### `writeRange`

指定範囲に値を書き込む。

**params**

```json
{
  "url": "<シート URL>",
  "tab": "売上",
  "range": "A1",
  "values": [["header1", "header2"], ["row1-1", "row1-2"]]
}
```

- `range` は左上セル。`values` のサイズで範囲が自動決まる

### `appendRows`

タブの末尾に行を追加。

**params**

```json
{
  "url": "<シート URL>",
  "tab": "売上",
  "rows": [["2026-04-23", "商品A", 1000]]
}
```

### `createTab`

新しいタブを追加。

**params**

```json
{ "url": "<シート URL>", "tab": "新タブ", "position": 0 }
```

- `position` は省略可

### `clearTab`

タブの内容を全クリア（タブ自体は残る）。

**params**

```json
{ "url": "<シート URL>", "tab": "古データ" }
```

### `renameTab`

タブ名変更。

**params**

```json
{ "url": "<シート URL>", "tab": "旧名", "newName": "新名" }
```

---

## 実行系

### `runScript`

**使い捨て実行**。渡した JS コードをそのまま評価し、結果を返す。保存はしない。

**params**

```json
{
  "url": "<シート URL>",
  "code": "const ss = SpreadsheetApp.openByUrl(params.url); return ss.getName();"
}
```

- `code` 内では `params` オブジェクト経由で入力値にアクセス可能
- `return` で返した値が `result.returnValue` に入る

**response.result**

```json
{ "returnValue": "任意の戻り値", "logs": ["Logger.log の出力"] }
```

---

## コンテナバインド GAS 操作

### `getBoundScript`

対象シートのコンテナバインド GAS のコードを取得。

**params**

```json
{ "url": "<シート URL>" }
```

**response.result**

```json
{
  "files": [
    { "name": "Code.gs", "source": "function onOpen() { ... }" },
    { "name": "appsscript.json", "source": "{\"timeZone\":\"Asia/Tokyo\",...}" }
  ]
}
```

### `writeBoundScript`

対象シートのコンテナバインド GAS にコードを保存。既存ファイルは上書き、指定外のファイルは残る。

**params**

```json
{
  "url": "<シート URL>",
  "files": [
    { "name": "Code.gs", "source": "function hello() { return 'hi'; }" }
  ]
}
```

### `registerBoundScript`

まだコンテナバインド GAS が存在しないシートに、新しく紐付ける。

**params**

```json
{ "url": "<シート URL>", "title": "Sheet Utilities" }
```

**response.result**

```json
{ "scriptId": "1abc...", "created": true }
```

---

## トリガー系

### `installTimeTrigger`

時間ベースのトリガーを設置。

**params**

```json
{
  "url": "<シート URL>",
  "functionName": "dailyUpdate",
  "spec": { "type": "dailyAt", "hour": 9 }
}
```

`spec.type` の種類:

- `everyMinutes` … `{ "type": "everyMinutes", "minutes": 5 }`
- `everyHours` … `{ "type": "everyHours", "hours": 1 }`
- `dailyAt` … `{ "type": "dailyAt", "hour": 9 }`
- `weeklyAt` … `{ "type": "weeklyAt", "weekDay": "MONDAY", "hour": 9 }`

### `installSheetTrigger`

スプレッドシート編集・変更イベントのトリガーを設置。

**params**

```json
{
  "url": "<シート URL>",
  "functionName": "onEditHandler",
  "event": "EDIT"
}
```

`event` の種類:

- `EDIT` … セル編集
- `CHANGE` … 構造変更（行追加・タブ追加など）
- `OPEN` … シートを開いたとき

### `listTriggers`

設置済みトリガーの一覧。

**params**

```json
{ "url": "<シート URL>" }
```

**response.result**

```json
{
  "triggers": [
    {
      "id": "abc123",
      "functionName": "dailyUpdate",
      "type": "CLOCK",
      "spec": { "type": "dailyAt", "hour": 9 }
    }
  ]
}
```

### `deleteTrigger`

トリガーを削除。

**params**

```json
{ "url": "<シート URL>", "triggerId": "abc123" }
```

---

## 手動で叩いてみる

デバッグ用に `curl` で直接叩くこともできます。

```bash
curl -X POST "https://script.google.com/macros/s/XXX/exec" \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN","action":"ping"}'
```

成功すれば以下のような JSON が返ります。

```json
{"ok":true,"result":{"pong":true,"ts":"2026-04-23T00:00:00Z"}}
```

`ok:false` が返った場合は `error.code` と `error.message` を確認してください。
