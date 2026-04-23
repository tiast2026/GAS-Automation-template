# 付録 C: セキュリティ詳細

このガイドは、Dispatcher の認証情報（URL + トークン）を **private リポジトリに直接コミットする** 運用を前提としています。「認証情報をリポジトリに置いて大丈夫か？」という疑問への回答と、万が一の漏洩に備えたローテ手順をこのページに集約します。

## なぜコミットして良いのか

private リポジトリへのコミットは、以下の理由で実用上安全と判断しています。

### 1. private リポジトリはアクセス制御されている

GitHub の private リポジトリは、明示的に招待されたコラボレーター・組織メンバーしか閲覧できません。これは GitHub Secrets や AWS Secrets Manager と本質的に同じアクセス制御モデルです（アクセス制御の仕組みは別ですが、前提となる信頼モデルは同等）。

### 2. 利便性のトレードオフで利便性が勝る

認証情報をコミットすることで得られる利便性:

- Web Claude・スマホ Claude・デスクトップ Claude のどれでも、リポジトリを開いた瞬間に Dispatcher へ接続可能
- 新しい PC に移っても、git clone だけで即環境が整う
- チームメンバーを招待すれば、そのメンバーも即座に同じ Dispatcher を使える

リポジトリ外で認証情報を管理する方法（環境変数、シークレット管理サービス等）を採用すると、上記の利便性が全て損なわれ、「セッションごとに認証ファイルを手作業でアップロード」という、運用面で大きな負担になる状態に戻ってしまいます。

### 3. Dispatcher の URL は権限を付与しない

URL を知っているだけでは何もできません。`SECRET_TOKEN` が一致する HTTP POST のみが受け付けられます。また、たとえトークンが漏れても、後述の **1 操作** でデプロイをアーカイブすれば全アクセスを即座に無効化できます。

---

## 必ず守ること

### リポジトリは private であり続ける

**これは絶対条件です。** リポジトリを public に変更する前には、必ず後述のローテ手順を実施してください。うっかり public に変更すると、コミット履歴を遡って誰でも URL とトークンを抽出できる状態になります。

対策として、リポジトリの Settings → Danger Zone に **「Archive this repository」** や **「Change visibility」** の警告バナーを書いておくのも有効です。

### トークンは推測不能な長さ・ランダム性を確保する

`SECRET_TOKEN` には **64 文字以上** のランダム文字列を使用してください。推奨は 128 文字です。

推奨生成方法:

```js
// ブラウザのコンソールで
crypto.randomUUID() + crypto.randomUUID()
// 出力例: c6b1f8e2-...-aa4e56b2c6b1f8e2-...-aa4e (72 文字)
```

以下は **使わないでください**:

- `password123` のような辞書で推測可能な文字列
- 会社名・自分の名前などの識別可能な単語
- 短い文字列（16 文字未満）

### スクリプト内に他の API キーを直書きしない

Dispatcher のコードや、コンテナバインド GAS のコードに、外部 API キー（OpenAI、Slack、BigQuery 等）を直接書かないでください。

正しい方法:

```js
// ❌ ダメな例
const API_KEY = 'sk-abcdefg...';

// ✅ 正しい方法
const API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
```

スクリプトプロパティはリポジトリには保存されないため、万が一リポジトリが漏れても外部 API キーは守られます。

---

## 漏洩時 / public 化時のローテ手順

「トークンが漏れたかもしれない」「リポジトリを public にしたい」という場合、以下を直ちに実施してください。所要時間 3 分程度です。

### 1. 旧 Deploy をアーカイブ（URL を即失効）

1. [script.google.com](https://script.google.com) で Dispatcher プロジェクトを開く
2. 右上 **「デプロイ」** → **「デプロイを管理」**
3. 現在の Deploy の右側 **🗑️（ゴミ箱）アイコン** → **「アーカイブ」**
4. アーカイブした時点で、その URL に対する全ての POST は `404` を返すようになります

これだけで既存のトークンは **完全に無力化** されます。

### 2. `SECRET_TOKEN` を新規生成して上書き

1. Apps Script エディタ左下 **⚙️「プロジェクトの設定」**
2. **「スクリプト プロパティ」** の `SECRET_TOKEN` の値を、新しいランダム文字列に書き換え
3. **「スクリプト プロパティを保存」**

### 3. 新規 Deploy で新 URL を発行

1. 右上 **「デプロイ」** → **「新しいデプロイ」**
2. 第 2 章 Step 3-5 と同じ設定（種類: ウェブアプリ、実行: 自分、アクセス: 全員）
3. 新しい URL をコピー

### 4. `.claude/gas-dispatcher.json` を更新

新 URL と新トークンで `.claude/gas-dispatcher.json` を書き換え、コミット。

```json
{
  "url": "https://script.google.com/macros/s/NEW_DEPLOY_ID/exec",
  "token": "新しいランダム文字列"
}
```

### 5. (任意) git 履歴から旧トークンを除去

旧トークンがコミット履歴に残っているのが気になる場合は、[`git filter-repo`](https://github.com/newren/git-filter-repo) でスカッシュ/除去できます。

```bash
git filter-repo --replace-text <(echo '旧トークン文字列==>REDACTED')
git push --force-with-lease
```

ただし、**アーカイブ済みの旧デプロイにはもう誰もアクセスできない** ため、履歴に残っていても実害はありません。完全性が気になる場合のみ実施してください。

### 6. (public 化する場合のみ) `.claude/gas-dispatcher.json` を削除

public 化する場合は、新 URL・新トークンを **リポジトリにコミットしない** でください。

```bash
# gitignore 済みの local ファイルだけに書く
# .claude/gas-dispatcher.local.json
{
  "url": "...",
  "token": "..."
}
```

これでコミット版の `gas-dispatcher.json` はリポジトリから消え、`.local.json` だけが手元に残ります。Web / スマホの Claude からは使えなくなりますが、public 化するならその前提は飲む必要があります。

---

## Dispatcher 実行ユーザーの権限スコープ

Deploy 時に「次のユーザーとして実行: **自分**」を選んだ場合、Dispatcher は **Deploy したアカウントの権限** で動作します。

これは以下を意味します。

### できること

- Deploy アカウントで見える **全ての** Google スプレッドシートを読み書きできる
- Deploy アカウントの Drive 全体にアクセスできる
- Deploy アカウントで許可した OAuth スコープ内で、Google サービス全般を呼べる

### 影響範囲

業務用 Google アカウントで Deploy すると、そのアカウントが閲覧・編集できるシート全てに Dispatcher 経由で触れることになります。これは **トークンを知っている人 = 自分だけ** が許された操作範囲なので通常は問題ありませんが、以下の場合は注意してください。

- **社内の機密シートへのアクセス権** を持つ業務用アカウントで Deploy する場合
- **Google Workspace の組織ポリシー** で Apps Script の外部公開が禁止されている場合

どちらかに該当する場合は、個人用の Google アカウントで Dispatcher を立てて、必要なシートだけを個別共有するのが安全です。

### スコープを最小化する場合

Dispatcher が要求するスコープは `appsscript.json` の `oauthScopes` で制御できます。デフォルトでは以下が付与されますが、不要なものは削除してください。

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

| スコープ | 用途 | 外したときの影響 |
|---|---|---|
| `spreadsheets` | シート読み書き | 全ての読み書きが不可に |
| `drive` | Drive 操作（ファイル検索・移動など） | 新規シート作成などが不可に |
| `script.external_request` | 外部 HTTP（`UrlFetchApp`） | BigQuery・外部 API 連携が不可に |
| `script.scriptapp` | トリガー操作 | トリガー設置・削除が不可に |

---

## チェックリスト

セットアップ完了後、以下を一通り確認してください。

- [ ] リポジトリは private になっている
- [ ] `SECRET_TOKEN` は 64 文字以上のランダム文字列
- [ ] `.claude/gas-dispatcher.json` の `token` と Apps Script の `SECRET_TOKEN` は完全一致
- [ ] 旧方式の認証ファイル（`.clasprc.json` など、[付録 A](./legacy-clasp) 参照）をうっかりコミットしていない
- [ ] Dispatcher 実行ユーザーのアカウントで扱いたくないシートを開いていない
- [ ] リポジトリのコラボレーター一覧に、想定外のメンバーがいない

問題があれば前述のローテ手順を実施してください。
