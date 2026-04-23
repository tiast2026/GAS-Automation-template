---
prev:
  text: '第1章: 全体像'
  link: '/guide/01-overview'
next:
  text: '第3章: 動作確認'
  link: '/guide/03-verify'
---

# 第2章: 5 分セットアップ

このガイド最大の山場ですが、実作業は **ブラウザだけで 5 〜 10 分** です。PC にソフトを入れたり、認証ファイルをアップロードしたりする工程はありません。

## ステップ全体像

| Step | 内容 | 目安時間 |
|---|---|---|
| 1 | アカウント確認 | 1 分 |
| 2 | GitHub リポジトリを作る（private）| 1 分 |
| 3 | 窓口 GAS（Dispatcher）を Deploy | 5 分 |
| 4 | 接続情報をリポジトリにコミット | 1 分 |
| 5 | Claude Code で接続確認 | 1 分 |

---

## Step 1: アカウント確認

以下 3 つが揃っていれば、この Step はスキップして Step 2 へ。

| アカウント | 用途 | 料金 |
|---|---|---|
| Google | スプレッドシート / GAS の操作 | 無料（業務用推奨） |
| GitHub | コードと接続情報の保管 | 無料 |
| Claude（Anthropic）| Claude Code の利用 | Pro 以上のサブスクリプション |

### Google アカウント

業務データを扱うなら **業務用の Google Workspace アカウント** を強く推奨します。プライベート用 Gmail と業務データを混ぜないため。

会社から配布されている Google Workspace アカウントがあれば、それを使ってください。

### GitHub アカウント

未作成なら [github.com/signup](https://github.com/signup) から登録（無料、1 分）。2 要素認証は後からでも設定できますが、有効化を強く推奨します。

### Claude アカウント

[claude.ai](https://claude.ai) でサインアップ。Claude Code を使うには **Pro プラン以上** が必要です（Free プランでは Claude Code 機能が開放されません）。

---

## Step 2: GitHub リポジトリを作る

テンプレートリポジトリ（必要な Dispatcher コードと設定一式が揃った雛形）から作ります。

1. ブラウザで [https://github.com/tiast2026/GAS-Automation-template](https://github.com/tiast2026/GAS-Automation-template) を開く
2. 右上の緑色のボタン **「Use this template」** → **「Create a new repository」**
3. リポジトリ名は任意（例: `gas-automation`）
4. 公開範囲は **必ず「Private」** を選ぶ
5. **「Create repository」** をクリック

::: danger 必ず Private を選ぶ
この後のステップで **Dispatcher の URL とトークンをコミット** します。Public リポジトリにすると、その時点で誰でもあなたのスプレッドシートを読み書きできる状態になります。

「あとで Public に切り替える」のも NG です。切り替えるには URL とトークンを先にローテーションする必要があります（[付録 C](/appendix/security) 参照）。
:::

テンプレート作成時に以下のファイルがコピーされます。

| ファイル | 役割 |
|---|---|
| `CLAUDE.md` | Claude Code への全体指示書 |
| `.claude/settings.json` | SessionStart フックの設定 |
| `scripts/_dispatcher/Code.gs` | **Dispatcher の本体コード** |
| `scripts/_dispatcher/appsscript.json` | Dispatcher のマニフェスト |
| `docs/` | このドキュメントサイト（VitePress）|

---

## Step 3: 窓口 GAS（Dispatcher）を Deploy

ここが本作業。ブラウザで Apps Script のデプロイ画面を 1 往復するだけです。

### 3-1. 空の Apps Script プロジェクトを作る

1. [https://script.google.com/home](https://script.google.com/home) を開く
2. 左上 **「+ 新しいプロジェクト」** をクリック
3. プロジェクト名を **`GAS Dispatcher`** に変更（画面上部のタイトルをクリック）

### 3-2. コードを貼り付け

1. GitHub で Step 2 で作ったリポジトリを開く
2. `scripts/_dispatcher/Code.gs` を開く → 右上の **「Copy raw contents」** アイコンで全文コピー
3. Apps Script エディタに戻り、左の **`コード.gs`** をクリック
4. 既存内容を全選択して削除
5. コピーした内容を貼り付け
6. `Ctrl + S`（Mac は `Cmd + S`）で保存

### 3-3. マニフェスト（appsscript.json）を表示・編集

1. Apps Script エディタ左の **歯車アイコン（プロジェクトの設定）**
2. **「『appsscript.json』マニフェスト ファイルをエディタで表示する」** にチェック
3. エディタに戻り、**`appsscript.json`** タブをクリック
4. GitHub で `scripts/_dispatcher/appsscript.json` の内容をコピーして貼り付け
5. `Ctrl + S` で保存

### 3-4. シークレットトークンを生成して設定

Dispatcher の認証に使うランダムな文字列を発行します。

**トークンを作る方法（どれでも可）:**

- ブラウザの開発者コンソール（F12）で `crypto.randomUUID() + crypto.randomUUID()` を実行してコピー
- ターミナルが使えるなら `openssl rand -hex 32`
- [https://1password.com/password-generator/](https://1password.com/password-generator/) 等の生成サイト

**64 文字程度のランダム文字列** を控えておきます。

**Apps Script 側に登録:**

1. 歯車アイコン（プロジェクトの設定）
2. 下のほう **「スクリプト プロパティ」** → **「スクリプト プロパティを追加」**
3. 入力:
   - **プロパティ**: `SECRET_TOKEN`
   - **値**: 先ほど生成したランダム文字列
4. **「スクリプト プロパティを保存」**

### 3-5. Google Apps Script API を有効化

Dispatcher から各シートのコンテナバインド GAS を書き換えるために必要です。アカウント単位の設定。

1. [https://script.google.com/home/usersettings](https://script.google.com/home/usersettings) を開く
2. **「Google Apps Script API」** を **ON** にする

### 3-6. ウェブアプリとしてデプロイ

1. エディタ右上 **「デプロイ」** → **「新しいデプロイ」**
2. 左側の **歯車アイコン** → **「ウェブアプリ」** を選択
3. 設定:
   - **説明**: `GAS Dispatcher v1`（任意）
   - **実行するユーザー**: **自分** ← 重要
   - **アクセスできるユーザー**: **全員** ← 重要（トークンで保護されるので安全）
4. 右下 **「デプロイ」**

### 3-7. OAuth 同意

初回デプロイ時に「アクセスを承認」ボタンが出ます。

1. クリック → Google アカウント選択
2. 「このアプリは Google で確認されていません」画面が出たら:
   - **「詳細」** をクリック
   - **「〜に移動（安全ではないページ）」** をクリック
3. 権限リストを確認して **「許可」**

::: tip 「安全ではない」表示について
これは Google が未審査の自作 GAS に対して常に出す警告です。**自分で書いた自分用の GAS なので安全** 。他人が作った GAS では絶対にやらないでください。
:::

### 3-8. URL をコピー

デプロイ完了画面で以下が表示されます。

```
ウェブアプリ
URL: https://script.google.com/macros/s/XXXXXXXXXXXX/exec
```

この URL をコピーして控えておきます。

---

## Step 4: 接続情報をリポジトリにコミット

Step 3 で得た **URL** と **トークン** をリポジトリに書き込みます。

### GitHub Web UI で直接作る（おすすめ）

ローカル clone も git も不要。ブラウザだけで完結します。

1. Step 2 で作ったリポジトリを GitHub で開く
2. 上部 **「Add file」** → **「Create new file」**
3. ファイル名欄に `.claude/gas-dispatcher.json` と入力（スラッシュを打つとフォルダ扱いになります）
4. 中身に以下を貼り付け、URL とトークンを実際の値に差し替え

```json
{
  "url": "https://script.google.com/macros/s/XXXXXXXXXXXX/exec",
  "token": "ここに Step 3-4 で生成したトークン"
}
```

5. 下までスクロール → **「Commit changes」** → デフォルトメッセージのまま **「Commit directly to the main branch」** で OK

これで準備は完了。

### ローカルで作りたい場合

```bash
git clone git@github.com:<your>/<repo>.git
cd <repo>
mkdir -p .claude
cat > .claude/gas-dispatcher.json <<'EOF'
{
  "url": "https://script.google.com/macros/s/XXXXXXXXXXXX/exec",
  "token": "あなたのトークン"
}
EOF
git add .claude/gas-dispatcher.json
git commit -m "Add dispatcher connection info"
git push
```

### 補足: 個人端末で別 Dispatcher を使いたいとき

`.claude/gas-dispatcher.local.json`（`.gitignore` 済み、コミットされない）を同じフォーマットで作ると、こちらが優先されます。テスト用 Deploy や本番切替の検証に便利。

---

## Step 5: Claude Code で接続確認

1. [claude.ai](https://claude.ai) にログイン → 左メニューの **Code** を開く
2. **Connect GitHub** から Step 2 のリポジトリを接続（初回のみ）
3. リポジトリを選んで **New session** を開始
4. セッション開始直後のログに以下が出れば成功:

```
[gas-dispatcher] loaded from .claude/gas-dispatcher.json url=https://script.google.com/macros/s/...
```

セッション内に以下を投げて動作確認:

```
窓口 GAS（Dispatcher）の疎通確認をお願いします。
```

Claude が `ping` エンドポイントを叩いて、あなたの Google アカウントのメールアドレスとタイムゾーンを返してきたら **セットアップ完了** です。

::: tip `loaded from ...` が出ないとき
- `.claude/gas-dispatcher.json` が `main` ブランチにコミットされているか GitHub 上で確認
- JSON の構文エラー（カンマ忘れ、クォート抜け）がないか確認
- Claude Code で「このリポジトリの `.claude/gas-dispatcher.json` の中身を見せて」と依頼して内容確認
- それでもダメなら [第 5 章: トラブル & FAQ](/guide/05-troubleshoot-faq) へ
:::

---

## セキュリティ要点

Step 4 で **URL + トークン** をコミットしました。これを持っている人はあなたのシートを操作できます。

- リポジトリは **絶対に private 以外にしない**
- Deploy URL を画面共有・SNS に流さない
- 漏洩したら即「デプロイを管理」で古い Deploy を **アーカイブ**、新 URL + 新トークンで再デプロイ
- 詳細な運用ルールは [付録 C: セキュリティ詳細](/appendix/security)

---

## 次の章へ

環境ができたので、次は **テスト用のスプレッドシート** で読み書きが成功することを確認します。

[第 3 章: 動作確認 →](./03-verify)
