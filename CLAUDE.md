# GAS-Automation プロジェクト指示書

このリポジトリは **スプレッドシート URL を受け取って GAS を自動で書き込み・実行・デバッグするためのハブ** です。

> **セッション引き継ぎ**: 直近の作業状況・未完了タスク・ユーザーへの依頼事項は [`.claude/HANDOFF.md`](.claude/HANDOFF.md) を先に読むこと。新セッションはここに着地してから本文に入る。

## 基本方針

**窓口 GAS（Dispatcher）1 本を経由してオンラインで完結する** 構成を標準とする。

- `scripts/_dispatcher/` に中継 GAS が 1 個だけ常駐
- Claude は HTTP で `GAS_DISPATCHER_URL` を叩いて全操作を行う
- ローカルに `clasp` や Google 認証を用意する必要なし（Web/スマホ Claude でも動く）
- 書いたコードを保存したい場合は、各シートの **コンテナバインド GAS に自動で格納** される

詳細は:
- [`scripts/_dispatcher/Code.gs`](scripts/_dispatcher/Code.gs) — 本体
- [`docs/guide/02-setup.md`](docs/guide/02-setup.md) — 初回デプロイ手順（ユーザーが 1 回だけ実施）
- [`docs/appendix/dispatcher-api.md`](docs/appendix/dispatcher-api.md) — API リファレンス

## 環境変数

Claude は以下 2 つが環境に入っている前提で動く:

- `GAS_DISPATCHER_URL` — Web アプリ URL
- `GAS_DISPATCHER_TOKEN` — 共有トークン

SessionStart フックが以下の順で探す:

1. `.claude/gas-dispatcher.local.json`（gitignore 済み、個人端末向けの上書き用）
2. `.claude/gas-dispatcher.json`（**リポジトリにコミット** 、Web/スマホ版 Claude でも共有）

このリポジトリは **private** 前提で、コミット版の `gas-dispatcher.json` を主として運用する。公開リポジトリで運用する場合は必ず gitignore に戻し、漏れたトークンは即アーカイブ＋新規発行。

未設定の場合は、ユーザーに [`docs/guide/02-setup.md`](docs/guide/02-setup.md) を案内する。

## Dispatcher 呼び出し規約（**必読・厳守**）

Dispatcher を叩くときは **必ず `scripts/call-dispatcher.sh` 経由** にする。curl / fetch / UrlFetchApp を直に書かない。

```bash
# 基本形
bash scripts/call-dispatcher.sh <action> [json_object]

# 例
bash scripts/call-dispatcher.sh ping
bash scripts/call-dispatcher.sh listTabs  '{"sheetId":"1AbC..."}'
bash scripts/call-dispatcher.sh readCell  '{"sheetId":"1AbC...","a1":"A2"}'
bash scripts/call-dispatcher.sh runScript '{"sheetId":"1AbC...","code":"return ss.getName();"}'
```

### なぜヘルパー必須か

Apps Script の Web App は POST を受けると **302 で `script.googleusercontent.com/macros/echo` にリダイレクトし、リダイレクト先は GET でアクセス** しなければならない。これを知らずに

- `curl -X POST` を明示する
- Node の `fetch` / `axios` でデフォルトのリダイレクト処理に任せる
- Google Apps Script の `UrlFetchApp.fetch` で `followRedirects: true` のまま POST する

のいずれかをやると、リダイレクト先にも POST してしまって Google Drive の **「Sorry, unable to open the file at this time.」** が返ってくる。これを見て「Deploy が壊れてる」と誤診断する Claude セッションが頻発しているので、**このヘルパー 1 本に統一** する。

### ヘルパーが使えない状況（ほぼ発生しない想定）

`bash` が使えない環境で自前で curl を書くなら、以下を死守:

- `-X POST` を **明示しない**（`-d` だけで curl が自動で POST になる）
- `-L` でリダイレクトを追う（curl のデフォルト挙動で 302 → GET に切り替わる）
- `Content-Type: application/json` を付ける

Node / Python / UrlFetchApp など curl 以外を使う必要が出たら、ヘルパー拡張 or Dispatcher 側改修のほうが早いのでまず相談する。

### 症状と誤診断の対応表

| 症状 | 真の原因 | 対処 |
|---|---|---|
| POST が "Sorry, unable to open the file at this time." を返す | クライアント側のリダイレクト後メソッドが POST のまま | **ヘルパーを使う** 。Deploy は壊れていない |
| POST だけ HTML（ログイン画面）が返る | Deploy のアクセスが「全員」になっていない | Apps Script で Deploy 設定確認 |
| すべて 404 | URL が古い / Deploy がアーカイブされた | `.claude/gas-dispatcher.json` の URL を更新 |
| `unauthorized` | トークン不一致 | `SECRET_TOKEN` と `.claude/gas-dispatcher.json` の token を揃える |

**「Deploy を作り直してください」とユーザーに頼む前に、必ずヘルパーで `ping` して生存確認すること。**

## コンテナバインド GAS の登録フロー（**重要**）

Google の公開 API には **「シート ID → バウンド スクリプト ID」の解決エンドポイントが存在しない** 。`Drive API` / `Apps Script API` / `DriveApp` を総当たりしても不可能。UI の「拡張機能 → Apps Script」は session cookie 経由の非公開エンドポイントで解決している。

そのため、**新しいシートのコンテナバインド GAS を初めて触るときは、ユーザーにスクリプト ID を 1 回だけ教えてもらう** 必要がある。

### 登録済みシートの一覧は `.claude/bound-scripts.json`

リポジトリにコミットされているので、どの端末・どのセッションからも同じ情報が見える。SessionStart フックが Dispatcher にこれを同期する（`scripts/sync-bound-scripts.sh`）。

### 未登録シートの扱い（Claude が自動で判断する流れ）

ユーザーがスプレッドシート URL を投げてきたら:

1. `.claude/bound-scripts.json` の `entries` に該当 `sheetId` があるか確認
   - あれば何もしなくて OK（Dispatcher 側も同期済みのはず）
2. 無ければ `listBoundScripts` で Dispatcher 側に直接問い合わせ（JSON が古い可能性もあるため）
3. それでも無ければ、ユーザーに **ちょうどこの 1 文** を返す:

   > このシートのコンテナバインド GAS はまだ登録されていません。以下を教えてください:
   >
   > 1. スプレッドシートを開いて「拡張機能 → Apps Script」
   > 2. 開いた Apps Script エディタの URL をそのまま貼り付け

4. URL が来たら以下を実行:

   ```bash
   bash scripts/register-sheet-script.sh "<シート URL>" "<Apps Script URL>"
   ```

   このヘルパーが:
   - Dispatcher に `registerBoundScript` を叩く（URL のまま投げられる）
   - `.claude/bound-scripts.json` に追記する
   - コミット & push コマンドを案内する

5. 変更をコミット & push すれば、以降他のセッションでも自動同期される

### 「読み書き可能な状態」の期待値

- 登録済みシート: ゼロ設定で `getBoundScript` / `writeBoundScript` が通る
- 未登録シート: 上記 3〜5 を踏めばその場で登録され、以降ゼロ設定

**絶対にやってはいけないこと**: 未登録のまま `writeBoundScript` に `autoCreate: true` を付けて新規作成すること。既存のコンテナバインド GAS がある場合、これは **別の空プロジェクトを新規に作ってしまい、既存コードは放置** される。

## ワークフロー

ユーザーがスプレッドシート URL と指示を送ってきたら、以下の順で動く。

### 1. ID 抽出

URL `https://docs.google.com/spreadsheets/d/XXX/edit#gid=0` → ID は `XXX`（`/d/` と次の `/` の間）。

### 2. 構造把握

```bash
bash scripts/call-dispatcher.sh listTabs     '{"sheetId":"..."}'
bash scripts/call-dispatcher.sh describeTab  '{"sheetId":"...","tab":"..."}'
bash scripts/call-dispatcher.sh readTab      '{"sheetId":"...","tab":"...","range":"A1:Z30"}'
```

大量データは一度に全件読まず、先頭 20〜50 行だけ読んで構造を把握。

### 3. 処理方針を決定

依頼内容に応じて:

| 依頼タイプ | 使用エンドポイント | 保存されるか |
|---|---|---|
| 「A2 の値は？」単発クエリ | `readCell` | ❌ 使い捨て |
| 「抽出を集計に整形」単発処理 | `runScript` | ❌ 使い捨て |
| 「集計ロジックを保存して再利用したい」 | `writeBoundScript` | ✅ 対象シートのコンテナバインド GAS |
| 「メニューを付けて」 | `writeBoundScript`（`onOpen` 含む） | ✅ 同上 |
| 「毎朝 9 時に自動実行」 | `installTimeTrigger` + 必要に応じて `writeBoundScript` | ✅ 窓口 GAS のトリガー |
| 「編集したら反応して」 | `installSheetTrigger` | ✅ 窓口 GAS のトリガー |

### 4. 実行

- 使い捨て処理 → `runScript` で即実行
- 保存処理 → `writeBoundScript` で対象シートのコンテナバインド GAS に格納
- トリガー → `installTimeTrigger` / `installSheetTrigger`

### 5. 検証

- 書き込み系は実行後に `readTab` / `describeTab` で期待どおり入っているか確認
- エラーが出たら `error` メッセージを読み、コードを修正して再実行（自動で最大 3 回リトライ）

### 6. 報告

- 何を書き込み、どこに保存したか明記
- 保存先が対象シートのコンテナバインド GAS なら、その旨と「拡張機能 → Apps Script」で確認できる旨も伝える
- トリガーを仕込んだ場合は `listTriggers` で一覧を取って報告

## 破壊的操作のルール

以下は **事前にユーザーへ確認** してから実行する:

- `clearTab` — タブ全消去
- `writeBoundScript` で既存ファイルの全置換（差分マージできない場合）
- `deleteTrigger` — 複数トリガー削除
- `runScript` 内での `deleteSheet` / 大量行削除 / `clear()` 等

確認なしで実行してよいもの:
- 新規タブ作成（`createTab`）
- 追記（`appendRows`）
- 空タブへの `writeRange`
- `readXxx` 系全般

## コンテナバインド GAS の手動編集との共存

ユーザーが「拡張機能 → Apps Script」で直接編集した場合、Claude は次に触る前に **必ず `getBoundScript` で最新を取得** し、差分を確認する。勝手に全置換しない。

`getBoundScript` の結果に想定外の関数・ファイルがあった場合:
1. ユーザーに「現在このスクリプトに `xxx()` 関数があります。保持しますか？」と確認
2. 保持する場合は新しいコードとマージして `writeBoundScript`
3. マージ判断が難しい場合はユーザーに全文を提示して判断を仰ぐ

## GAS プロジェクトの命名と管理

- 窓口 GAS は固定で `scripts/_dispatcher/`（1 個のみ）
- 個別にコード資産をリポジトリで管理したい GAS は `scripts/<わかりやすい名前>/` に配置
- コンテナバインド GAS の実体は Google 側にあるが、**バックアップ用に同名で `scripts/<シート識別名>/` にコードコピーを保存** することを推奨

命名規則: ディレクトリ名は英小文字ケバブケース（例: `zozo-campaign-calendar`）。

## コーディング規約

- 関数名は英語 camelCase、ファイル名は日本語可
- 冗長なコメントは書かない。シンプルで直接実行可能なコード
- 共通定数は `const` でファイル冒頭に集約
- API 呼び出しヘルパーは共通化
- BigQuery を使う場合のプロジェクトはリポジトリの README に明記する

## セキュリティ

- `GAS_DISPATCHER_TOKEN` と `GAS_DISPATCHER_URL` はセットで「鍵」。両方漏れるとシートを操作される
- `.claude/gas-dispatcher.json` は **このリポジトリが private** 前提でコミットしている。公開化時は即 gitignore に戻して Deploy アーカイブ→再発行
- `.claude/gas-dispatcher.local.json` は gitignore 済み。個人端末で URL/トークンを上書きしたい時だけ使う
- 漏洩時の対応: GAS エディタ → 「デプロイを管理」→ 古い Deploy を**アーカイブ** → 新規 Deploy → `.claude/gas-dispatcher.json` 更新してコミット
- スクリプト内に API キーを直書きしない。`PropertiesService.getScriptProperties()` を使う

## やってはいけないこと

- ユーザーの明示許可なく `clearTab` / `deleteTrigger` / 本番データ削除系 `runScript` を実行
- 既存のコンテナバインド GAS を **現状を確認せずに** `writeBoundScript` で全置換
- **public リポジトリ** でトークンや URL をコミット（private 前提の `.claude/gas-dispatcher.json` を public 化しない）
- 窓口 GAS のトークンや URL を `.claude/settings.json` 本体や docs 配下のコミット対象に直書きする（VitePress のビルド出力に混入する恐れ）
- `~/.clasprc.json` を生成・コミットする（この構成では使わない）

## 旧 clasp ワークフローについて

このリポジトリは以前は `clasp push` ベースで運用していたが、オンライン完結のため **廃止** 。
もし clasp を使いたい個別ケース（大規模プロジェクト、ローカル IDE での深い編集が必要等）があれば、その GAS プロジェクトの `README.md` に明記した上で併用して OK。
