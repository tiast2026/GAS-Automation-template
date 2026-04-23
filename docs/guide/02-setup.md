# 第 2 章: 5 分セットアップ

この章を順番に進めれば、5 分ほどで環境が立ち上がります。必要なのはブラウザだけです。PC にインストールするものは一切ありません。

::: tip 全体の流れ
1. アカウント確認（1 分）
2. GitHub リポジトリを作る（1 分）
3. Dispatcher GAS を Deploy する（5 分）
4. 認証情報をリポジトリにコミット（1 分）
5. Claude Code で接続確認（1 分）
:::

## Step 1: アカウント確認（1 分）

以下の 3 つが使える状態であることを確認してください。

| アカウント | 用途 | 取得先 |
|---|---|---|
| Google | スプレッドシート・Apps Script の実行 | [accounts.google.com](https://accounts.google.com/signup) |
| GitHub | コードと認証情報の保管 | [github.com/signup](https://github.com/signup) |
| Claude（Pro 以上） | Claude Code の利用 | [claude.ai](https://claude.ai) |

すでに業務で使っているものがあれば、そのまま流用して問題ありません。業務用 Google アカウントで Deploy する場合は、そのアカウントが見えるシート全てに Dispatcher からアクセスできることになる点だけ意識しておいてください（詳細は [付録 C](../appendix/security) 参照）。

---

## Step 2: GitHub リポジトリを作る（1 分）

1. ブラウザで [GAS-Automation-template](https://github.com/tiast2026/GAS-Automation-template) を開く
2. 右上の **「Use this template」** → **「Create a new repository」** をクリック
3. リポジトリ名は任意（例: `my-gas-automation`）
4. **必ず「Private」を選択**して作成

::: warning なぜ private 必須か
このリポジトリには Dispatcher の URL とトークンを **コミット** します。public にすると、URL とトークンを入手した誰でもあなたのスプレッドシートを操作できてしまいます。

public で運用したい場合は、認証情報をリポジトリ外（環境変数やシークレット管理サービス）で扱う必要があります。[付録 C: セキュリティ詳細](../appendix/security) を参照してください。
:::

---

## Step 3: Dispatcher GAS を Deploy する（5 分）

窓口となる Dispatcher GAS を Apps Script 上に Deploy します。これは **全プロジェクトを通じて 1 個だけ** あれば十分で、一度作れば以降は使い回します。

### 3-1. 新しい Apps Script プロジェクトを作る

1. ブラウザで [script.google.com](https://script.google.com) を開く
2. 左上の **「新しいプロジェクト」** をクリック
3. 左上のプロジェクト名（初期値「無題のプロジェクト」）を **`Dispatcher`** に変更

![新しいプロジェクトを作成](/images/02-new-script-project.png)

### 3-2. `Code.gs` を貼り付ける

1. 左側のファイル一覧から `コード.gs` を開く（初期ファイル）
2. 中身を全て削除
3. テンプレートリポジトリの `scripts/_dispatcher/Code.gs` の中身を全文コピーして貼り付ける
4. 「💾 保存」ボタン（Ctrl/Cmd + S）で保存

![Code.gs を貼り付け](/images/02-paste-code.png)

### 3-3. `appsscript.json`（マニフェスト）を貼り付ける

1. 左下の **⚙️（歯車）「プロジェクトの設定」** を開く
2. **「『appsscript.json』マニフェスト ファイルをエディタで表示する」** にチェック
3. エディタに戻り、ファイル一覧に現れた `appsscript.json` を開く
4. 中身を、テンプレートリポジトリの `scripts/_dispatcher/appsscript.json` で置き換える
5. 保存

### 3-4. `SECRET_TOKEN` を設定する

Dispatcher は HTTP で公開されるため、あなた（Claude Code）だけが使えるトークンを仕込みます。

1. 左側 **⚙️「プロジェクトの設定」** を開く
2. 下部の **「スクリプト プロパティ」** セクションで **「スクリプト プロパティを追加」** をクリック
3. プロパティ名: **`SECRET_TOKEN`**
4. 値: **64 文字以上のランダム文字列**
5. **「スクリプト プロパティを保存」**

::: tip ランダムトークンの生成方法
ブラウザで F12 を押して開発者ツールを開き、Console タブで以下を実行するとランダム文字列が生成できます。

```js
crypto.randomUUID() + crypto.randomUUID()
```

出力された文字列（ハイフン含め 72 文字）をそのままコピーして `SECRET_TOKEN` に貼り付けてください。
:::

![スクリプトプロパティを設定](/images/02-script-properties.png)

### 3-5. ウェブアプリとしてデプロイ

1. エディタ右上の **「デプロイ」** → **「新しいデプロイ」**
2. **「種類の選択」（歯車マーク）** → **「ウェブアプリ」**
3. 設定:
   - **説明**: `Dispatcher v1`（任意）
   - **次のユーザーとして実行**: **自分**
   - **アクセスできるユーザー**: **全員**
4. **「デプロイ」** をクリック
5. 初回は Google アカウントへのアクセス許可を求められます → 「アクセスを承認」→ 警告画面で「詳細」→「Dispatcher（安全ではないページ）に移動」→ 権限を許可

![ウェブアプリとしてデプロイ](/images/02-deploy-webapp.png)

### 3-6. デプロイ URL をコピー

デプロイ完了後、**「ウェブアプリ URL」** が表示されます。

```
https://script.google.com/macros/s/AKfycb.../exec
```

この URL を手元にコピーしておいてください。**次のステップで使います**。

![デプロイ URL](/images/02-deploy-url.png)

::: warning アクセス設定の確認
「アクセスできるユーザー」が **「全員」** になっていないと、Claude Code がアクセスしたときに Google のログイン画面 HTML が返ってきてエラーになります。必ず「全員」を選んでください。

なお、「全員」= 誰でも操作できる、ではありません。Dispatcher は上で設定した `SECRET_TOKEN` が一致するリクエストしか受け付けないので、URL が漏れてもトークンがないと操作できません。
:::

---

## Step 4: 認証情報をリポジトリにコミット（1 分）

Claude Code が Dispatcher に接続できるよう、URL とトークンをリポジトリに保存します。

1. Step 2 で作ったリポジトリを GitHub Web UI で開く
2. 上部の **「Add file」** → **「Create new file」**
3. ファイル名欄に **`.claude/gas-dispatcher.json`** と入力（`.claude/` の入力で自動的にディレクトリ扱いになります）
4. 中身に以下を貼り付け、URL とトークンを書き換える:

```json
{
  "url": "https://script.google.com/macros/s/XXXXXXXX/exec",
  "token": "Step 3-4 で設定した SECRET_TOKEN と同じ文字列"
}
```

5. 画面下部の **「Commit changes」** で `main` ブランチに直接コミット

![GitHub Web UI でコミット](/images/02-commit-config.png)

::: tip ローカル clone も git も不要
このステップは GitHub の Web UI だけで完結します。PC で `git` コマンドを使う必要はありません。
:::

::: danger トークンの一致チェック
`gas-dispatcher.json` の `token` は、Step 3-4 で設定した `SECRET_TOKEN` と **完全一致** している必要があります。貼り付け時に前後の空白や改行が混じると認証エラーになるので注意してください。
:::

---

## Step 5: Claude Code を起動して接続確認（1 分）

1. [claude.ai](https://claude.ai) を開く（Web 版・デスクトップ版・スマホ版どれでも OK）
2. Claude Code のパネルを開き、Step 2 で作ったリポジトリを接続
3. 新しいセッションを開始
4. 最初の自動表示（SessionStart フック）に以下が出ていれば成功です:

```
[gas-dispatcher] loaded from .claude/gas-dispatcher.json url=https://script.google.com/macros/s/...
```

この表示が出ていれば、Claude Code は環境変数 `GAS_DISPATCHER_URL` と `GAS_DISPATCHER_TOKEN` を認識しており、Dispatcher を叩ける状態です。

::: warning もし表示されない場合
- `.claude/gas-dispatcher.json` が `main` ブランチにコミットされているか確認
- ファイルパスが `.claude/gas-dispatcher.json`（ディレクトリ `.claude`、ファイル名 `gas-dispatcher.json`）になっているか確認
- JSON として壊れていないか確認（カンマ忘れ、クォート忘れなど）

それでも直らない場合は [第 5 章: トラブル & FAQ](./05-troubleshoot-faq) を参照してください。
:::

---

## セットアップ完了

お疲れさまでした。これで基盤は完成です。

次のページで実際に Claude Code からシートを読み書きできることを確認しましょう。
