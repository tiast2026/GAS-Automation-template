# scripts/_dispatcher/

**窓口 GAS（Dispatcher）** の本体ソース。このディレクトリのファイルを、ブラウザの Apps Script エディタに貼り付けて Deploy します。

> 📘 詳しい手順と画像付きの解説は [公式ガイド 第 2 章: 5 分セットアップ](https://gas-automation.vercel.app/guide/02-setup) を参照してください。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `Code.gs` | `doPost` エントリポイント + 全ハンドラ実装 |
| `appsscript.json` | タイムゾーン、Web アプリ設定、OAuth スコープ |
| `README.md` | このファイル |

## Deploy 手順（要約）

1. [script.google.com](https://script.google.com) で **「新しいプロジェクト」**
2. プロジェクト名を `Dispatcher` に変更
3. 初期ファイル `コード.gs` を開き、中身を `Code.gs` の内容で上書き
4. ⚙️「プロジェクトの設定」→ **「『appsscript.json』マニフェスト ファイルをエディタで表示する」** にチェック
5. エディタに戻って `appsscript.json` を開き、本ディレクトリの `appsscript.json` の内容で上書き
6. ⚙️「プロジェクトの設定」→ **スクリプト プロパティ** に以下を追加:
   - プロパティ名: `SECRET_TOKEN`
   - 値: 64 文字以上のランダム文字列（例: `crypto.randomUUID() + crypto.randomUUID()`）
7. 右上 **「デプロイ」→「新しいデプロイ」**
8. 種類: **ウェブアプリ** / 実行: **自分** / アクセス: **全員**
9. 初回は認可ダイアログを承認
10. 表示された **ウェブアプリ URL** を、リポジトリの `.claude/gas-dispatcher.json` に貼る

## OAuth スコープの内訳

`appsscript.json` で以下を要求しています。不要なものは削除しても動作するエンドポイントは動きます（対応表は [付録 C: セキュリティ詳細](https://gas-automation.vercel.app/appendix/security) 参照）。

| スコープ | 用途 |
|---|---|
| `spreadsheets` | シート読み書き（ほぼ全ハンドラで必要） |
| `drive` | バインドスクリプトを紐付ける対象シートの権限チェック |
| `script.projects` | コンテナバインド GAS の読み書き（`getBoundScript` / `writeBoundScript`） |
| `script.external_request` | `UrlFetchApp` で Apps Script API を叩くため |
| `script.scriptapp` | トリガー系ハンドラ（`installTimeTrigger` など） |

## アーキテクチャメモ

### コンテナバインド GAS の特定方法

`SpreadsheetApp.openByUrl()` だけではバインド済み GAS の `scriptId` を取得できないため、Dispatcher は **「URL → scriptId」の対応表を内部スクリプトプロパティに持つ** 設計です。

- `registerBoundScript` で最初に紐付ける（スクリプトプロパティ `boundScriptId.<spreadsheetId>` に記録）
- 以降の `getBoundScript` / `writeBoundScript` / トリガー系はこの対応表を参照

### トリガーの設置経路

`ScriptApp.newTrigger` は「自分自身のスクリプト」にしかトリガーを張れない制約があるため、トリガー系ハンドラは次の経路で動作します。

1. Apps Script API でバインド GAS に「トリガー設置用ヘルパ関数」を注入（`_dispatcherTriggerHelpers` ファイル）
2. Apps Script Execution API（`scripts.run`）でそのヘルパを呼び出す

ヘルパ注入は `ensureTriggerBootstrap` で idempotent に行われるので、同じシートに対する 2 回目以降は注入をスキップします。

## エンドポイント仕様

各アクションのパラメータと戻り値は [付録 B: Dispatcher API リファレンス](https://gas-automation.vercel.app/appendix/dispatcher-api) が正典です。`Code.gs` 内の `HANDLERS` オブジェクトがそれと 1:1 で対応しています。

## 動作確認（手動 curl）

Deploy 後の生存確認は、ブラウザではなく `curl` で行います。

```bash
curl -sS -X POST "https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN","action":"ping","params":{}}'
```

成功時は `{"ok":true,"result":{"pong":true,"ts":"..."}}`。

`UNAUTHORIZED` が返ったらトークン不一致、ログイン画面の HTML が返ったら Deploy 時のアクセス設定が「全員」になっていません。

## 拡張のしかた

新しいアクションを追加する場合:

1. `Code.gs` の `HANDLERS` オブジェクトに `<action名>: handle<Xxx>` を追加
2. 同ファイル内に `function handle<Xxx>(p) { ... }` を実装
3. `docs/appendix/dispatcher-api.md`（付録 B）にも仕様を追記
4. ブラウザの Apps Script エディタにコード再反映 → 「デプロイ」→ **「デプロイを管理」** → 既存の Deploy を「編集（✏️）」→ **「新しいバージョン」**
   - **URL は変わらない** ので `.claude/gas-dispatcher.json` の更新は不要
