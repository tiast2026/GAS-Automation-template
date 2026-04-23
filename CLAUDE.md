# GAS-Automation プロジェクト指示書

このリポジトリは **スプレッドシート URL を受け取って Google Apps Script (GAS) を自動で書き込み・実行・デバッグするためのハブ** です。

## 基本ワークフロー

ユーザーがスプレッドシート URL とともに指示を送ってきたら、以下の手順を自動で実行してください。

1. URL から `spreadsheetId` を抽出
2. `scripts/<わかりやすい名前>/` ディレクトリを作成（既にあれば再利用）
3. 対応する GAS プロジェクト ID を取得または作成
4. `.clasp.json` を作成
5. コードを `.gs` / `appsscript.json` として書き込む
6. `clasp push --force` で反映
7. エラーが出たら `clasp logs` で確認 → 修正 → 再 push
8. 成功したら自動で git commit & push（詳細は後述）

### スプレッドシート ID の抽出

URL 例: `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID_XXXXXXXXXXXXXXXXXXXXXXX/edit#gid=0`

→ ID は `YOUR_SPREADSHEET_ID_XXXXXXXXXXXXXXXXXXXXXXX`（`/d/` と次の `/` の間）。

### GAS プロジェクトの扱い方

GAS プロジェクトは2種類あるが、**このリポジトリではコンテナバインドをデフォルト** とする。「拡張機能 → Apps Script」から開く運用に揃えるため。

**パターン B: コンテナバインド GAS（デフォルト・推奨）**

手順:
1. ユーザーからスプレッドシートURLを受け取る
2. 対象スプレッドシートに既にGASが存在するか確認（ユーザーに質問）
3. 既存なし → ユーザーに以下を案内:
   > スプレッドシートを開いて「拡張機能 → Apps Script」を開き、URLの `/projects/` の後ろにある文字列（スクリプトID）を教えてください。
4. 既存あり → ユーザーから同様にスクリプトIDをもらう
5. `scripts/<プロジェクト名>/.clasp.json` を手動作成:
   ```json
   {
     "scriptId": "<スクリプトID>",
     "rootDir": "."
   }
   ```
6. `appsscript.json` と `.gs` ファイルを配置
7. `clasp push --force` で反映
8. 動作確認は スプレッドシートの「拡張機能 → Apps Script」から開いて手動実行

**パターン A: スタンドアロン GAS（例外時のみ）**

以下の場合にのみスタンドアロンを選ぶ:
- 複数のスプレッドシートを横断する処理
- スプレッドシートに依存しないバッチ処理（BigQuery直接操作など）
- ユーザーが明示的に「スタンドアロンで」と指定

```bash
cd scripts/<プロジェクト名>
clasp create --type standalone --title "<日本語タイトル>" --rootDir .
```

### appsscript.json のデフォルト

```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

スプレッドシート操作が必要なら `oauthScopes` に以下を追加:
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/script.external_request`

## コーディング規約

- 関数名は英語 camelCase、ファイル名は日本語も可
- トリガーは `setupTriggers()` 関数に集約
- API 呼び出しヘルパーは共通化
- 冗長なコメントは書かない、シンプルで直接実行可能なコードを優先
- API キーは `PropertiesService.getScriptProperties()` を使う

## Git 自動 commit & push ルール【重要】

**このリポジトリでは git 操作を完全自動化する。**

### 自動 commit & push のタイミング

以下のいずれかを完了した直後、必ず自動で `git add . && git commit && git push` を実行する。ユーザーへの確認は不要。

1. `clasp push --force` が成功した時
2. `.gs` / `appsscript.json` / `.clasp.json` を新規作成・更新した時
3. `CLAUDE.md` / `README.md` などのドキュメントを更新した時
4. `scripts/` 配下に新規プロジェクトディレクトリを作成した時

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

push競合時は `git pull --rebase origin main` してから再push。

### やってはいけないこと

- コミットメッセージを省略する・適当に書く
- `git push --force` の使用
- `.clasprc.json` や機密ファイルを commit する
- 作業途中の未完成コードを commit する（`clasp push` が成功してから）

## 実行コマンド早見表

```bash
clasp push --force          # コードを反映
clasp logs                  # ログを見る
clasp open-script           # Apps Script エディタを開く
clasp status                # プロジェクト情報
clasp show-authorized-user  # 認証中のユーザー確認
```

## 関数実行について（clasp 3.x の制約）

clasp 3.x では `clasp run` に GCP プロジェクトの紐付けが必須で手間が増えるため、**`clasp run` は使わない**。代わりに:

1. **動作確認**: `clasp open-script` で Apps Script エディタを開き、関数を手動実行
2. **本番運用**: `setupTriggers()` 関数でトリガー自動実行
3. **Web 実行**: 必要なら `doGet()` `doPost()` で WebApp 化

エラー確認は `clasp logs` で行う。

## エラー時の対応フロー

1. `clasp logs` で直近のログを取得
2. スタックトレースから該当行を特定
3. 修正を `.gs` ファイルに適用
4. `clasp push --force` で再反映
5. `clasp open-script` で Apps Script エディタを開き、関数を手動実行して再検証
6. 解決したら自動 commit & push
7. 解決するまで 1-5 を繰り返す

## セキュリティ

- **`.clasprc.json` は絶対に Git に commit しない**（`.gitignore` で対策済み）
- API キーはスクリプト内に直書きしない
