# GAS-Automation プロジェクト指示書

このリポジトリは **スプレッドシート URL を受け取って、Dispatcher GAS（窓口 API）経由で Google Apps Script を自動で書き込み・実行・デバッグするためのハブ** です。

## 基本ワークフロー

### セッション開始時の自動動作

Claude Code はセッション開始時に `.claude/load-dispatcher.sh`（SessionStart フック）を実行し、以下を行います。

1. `.claude/gas-dispatcher.local.json`（存在すれば優先）または `.claude/gas-dispatcher.json` を読む
2. 以下のログを出す

```
[gas-dispatcher] loaded from .claude/gas-dispatcher.json url=https://script.google.com/macros/s/.../exec
```

このログが出ていれば、以降のリクエストで `url` と `token` をこのファイルから読んで Dispatcher に HTTP POST できる状態です。

### ユーザーからの依頼を受けたら

ユーザーがスプレッドシート URL とともに指示を送ってきたら、以下を自動で実行してください。

1. **Dispatcher の生存確認**: `ping` エンドポイントを叩く（初回リクエストのみで十分）
2. **シート構造の把握**: `listTabs` / `describeTab` / `readTab` で既存タブや列構成を確認
3. **目的に応じて API を選択**:
   - 読み取り・集計 → `readTab` / `readCell` → メモリで処理 → チャット回答
   - 一度だけの処理 → `runScript`（使い捨て実行）
   - 継続利用のロジック → `writeBoundScript`（コンテナバインド GAS に保存）
   - トリガー設定 → `installTimeTrigger` / `installSheetTrigger`
4. **エラーが出たら**: Apps Script の実行ログを取得 → 原因特定 → コード修正 → 再実行
5. **成功したら**: 自動で git commit & push（詳細は後述）

### Dispatcher API の叩き方

常に以下の形式で POST する。URL とトークンは `.claude/gas-dispatcher.json` から取得。

```bash
URL=$(jq -r .url .claude/gas-dispatcher.json)
TOKEN=$(jq -r .token .claude/gas-dispatcher.json)
curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"action\":\"ping\",\"params\":{}}"
```

レスポンスは常に `{"ok":true, "result":...}` または `{"ok":false, "error":{"code":..., "message":...}}`。成功・失敗の判定は `ok` フィールドで行う。

アクション一覧は `docs/appendix/dispatcher-api.md`（付録 B）を正典として参照する。

### シート URL の扱い

スプレッドシート URL は **そのまま** Dispatcher に渡す（`spreadsheetId` の抽出は Dispatcher 側で行う）。ユーザーのプロンプトに含まれる URL は原則以下の形式。

```
https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
```

`/edit` や `#gid=0` が含まれていても問題なく処理される。ID だけ貼られた場合は `https://docs.google.com/spreadsheets/d/<ID>/edit` の形に組み立ててから渡す。

## GAS プロジェクトの扱い方

### デフォルト: コンテナバインド GAS（パターン B）

**このリポジトリではコンテナバインドをデフォルト** とします。スプレッドシートを開いて「拡張機能 → Apps Script」から辿れるため運用しやすい。

手順:

1. ユーザーからスプレッドシート URL を受け取る
2. `getBoundScript` で既存コードを取得（未バインドなら `{files: []}` 相当が返る）
3. 既存コードがあれば内容を読み、差分マージで書き換える
4. `writeBoundScript` でコードを保存（複数ファイル可）
5. 動作確認は `runScript` で関数を直接呼ぶ、または `installTimeTrigger` / `installSheetTrigger` でトリガー化

ローカルにコードのバックアップを残したい場合は `scripts/<プロジェクト名>/` に `.gs` と `appsscript.json` を配置してコミット。`.clasp.json` は **不要**（Dispatcher がシート URL で識別するため）。

### 例外: スタンドアロン GAS（パターン A）

以下の場合のみスタンドアロンを選ぶ:

- 複数のスプレッドシートを横断する処理
- スプレッドシートに依存しないバッチ処理（BigQuery 直接操作など）
- ユーザーが明示的に「スタンドアロンで」と指定した場合

スタンドアロン GAS を新規作成したい場合は、ユーザーにブラウザで [script.google.com](https://script.google.com) から作ってもらい、スクリプト ID を `scripts/<プロジェクト名>/dispatcher.json` に記録した上で、Dispatcher の `runScript` を Apps Script API 経由で呼ぶ設計にする。ほとんどの業務はコンテナバインドで足りるので、この経路は例外的。

## appsscript.json のデフォルト

保存型で書く際の `appsscript.json` はこれをベースにする。

```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

スプレッドシート操作・外部 API 呼び出しが必要なら `oauthScopes` を追加:

- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/script.external_request`

トリガーを張る場合は追加で:

- `https://www.googleapis.com/auth/script.scriptapp`

## コーディング規約

- 関数名は英語 camelCase、ファイル名は日本語も可
- トリガーは `setupTriggers()` 関数に集約し、手動実行で全トリガー再設置できるように
- API 呼び出しヘルパーは共通化
- 冗長なコメントは書かない、シンプルで直接実行可能なコードを優先
- API キーは `PropertiesService.getScriptProperties()` を使う。コードに直書き禁止

## 破壊的操作の扱い

以下の操作は **事前にユーザー確認を入れてから** 実行する。

- `clearTab`（タブ全クリア）
- タブ削除を含む処理
- 既存 `writeBoundScript` 内容を大幅に上書きするケース
- 10,000 行を超える範囲への `writeRange`

「先にサマリを見せて、問題なければ実行」の二段階で進める。

## Git 自動 commit & push ルール【重要】

**このリポジトリでは git 操作を完全自動化する。**

### 自動 commit & push のタイミング

以下のいずれかを完了した直後、必ず自動で `git add . && git commit && git push` を実行する。ユーザーへの確認は不要。

1. Dispatcher 経由でコード（`writeBoundScript` 含む）を書き換え、動作確認まで成功した時
2. `scripts/` 配下に新規プロジェクトディレクトリ・`.gs` ・ `appsscript.json` を作成・更新した時
3. `CLAUDE.md` / `README.md` / `docs/**` などのドキュメントを更新した時
4. `.claude/settings.json` / `.claude/load-dispatcher.sh` などの設定を更新した時

### コミットメッセージ規約

`<type>(<scope>): <日本語の概要>` の形式を厳守する。

| type | 意味 | 例 |
|---|---|---|
| `feat` | 新機能・新プロジェクト追加 | `feat(zozo-campaign): アーカイブ機能を追加` |
| `fix` | バグ修正 | `fix(meta-ads): 日次バックフィルのエラー修正` |
| `refactor` | 動作を変えないコード整理 | `refactor(共通設定): API呼び出しを統合` |
| `docs` | ドキュメント変更 | `docs: トラブルシュートを追記` |
| `chore` | 設定・雑務 | `chore: .gitignoreを更新` |

### 自動実行コマンド

```bash
git add .
git commit -m "<type>(<scope>): <概要>"
git push origin main
```

push 競合時は `git pull --rebase origin main` してから再 push。

### やってはいけないこと

- コミットメッセージを省略する・適当に書く
- `git push --force` の使用（明示指示があった場合のみ）
- `.claude/gas-dispatcher.local.json` など機密ファイルを commit する
- 作業途中の未完成コードを commit する（Dispatcher 経由の動作確認が成功してから）

## エラー時の対応フロー

1. Dispatcher のレスポンス `error.code` / `error.message` を確認
2. `code` 別の初手:
   - `UNAUTHORIZED` → `.claude/gas-dispatcher.json` の `token` と Apps Script スクリプトプロパティ `SECRET_TOKEN` の一致を確認
   - `NOT_FOUND` → タブ名・シート URL の typo を `listTabs` で検証
   - `PERMISSION_DENIED` → Dispatcher 実行ユーザーのシート編集権限を確認
   - `TIMEOUT` → 6 分制限。処理を分割してトリガーチェーン化
   - `INTERNAL_ERROR` → `error.message` のスタックトレースから該当行を修正
3. 修正後 `writeBoundScript` で再反映
4. `runScript` で再検証
5. 解決したら自動 commit & push

## 参考資料

- `docs/appendix/dispatcher-api.md` — Dispatcher API 完全リファレンス
- `docs/appendix/security.md` — private 前提の運用とローテ手順
- `docs/appendix/legacy-clasp.md` — 旧 clasp 方式からの移行ガイド
- `scripts/_dispatcher/` — Dispatcher 本体のソース（ブラウザで Deploy する元ファイル）

## セキュリティ

- **リポジトリは必ず private**。public 化する場合は [付録 C](docs/appendix/security.md) のローテ手順を先に実施
- **`.claude/gas-dispatcher.local.json` は絶対に commit しない**（`.gitignore` 済）
- `SECRET_TOKEN` は 64 文字以上のランダム文字列
- API キーはスクリプト内に直書きせず、`PropertiesService.getScriptProperties()` を使う
