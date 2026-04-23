---
prev:
  text: 'B: Dispatcher API リファレンス'
  link: '/appendix/dispatcher-api'
next: false
---

# 付録 C: セキュリティ詳細

Dispatcher 方式は「**private リポジトリに接続情報をコミットする**」という運用判断に依拠しています。この付録ではその根拠、守るべきルール、漏洩 / public 化時のローテーション手順をまとめます。

## なぜコミットしてよいのか

`.claude/gas-dispatcher.json` をリポジトリにコミットする運用は、一見すると「秘密情報を公開している」ように見えますが、以下の前提が揃えば **GitHub Secrets と同等のアクセス制御** になります。

1. **リポジトリが private**: 閲覧できるのは招待されたコラボレーターのみ
2. **コラボレーターが信頼できる人**: 社内や個人の運用で制御可能
3. **アクセス自体がトークン + URL の 2 要素**: 片方だけでは攻撃に使えない

この運用の **メリット** は大きく、Web 版・スマホ版含む全 Claude Code セッションでゼロ設定で動作することです。端末ごとの認証配布の手間が消える利便性と、private リポジトリ内での情報保管のリスクを天秤にかけ、利便性側に倒した設計です。

## 必ず守ること

### リポジトリを private に保つ

**絶対条件です** 。public にした瞬間、世界中の誰でもあなたのシートを操作できる状態になります。

public 化したい理由が出てきた場合は、**必ず事前に** このページの [ローテーション手順](#ローテーション手順漏洩時--public-化時) を実施してください。

### トークンを十分にランダム化する

`SECRET_TOKEN` は 64 文字以上、推測不能なランダム文字列にしてください。

**生成方法の例:**

| 方法 | コマンド / URL |
|---|---|
| ブラウザ F12 | `crypto.randomUUID() + crypto.randomUUID()` |
| macOS / Linux | `openssl rand -hex 32` |
| Password Generator | [1password.com/password-generator/](https://1password.com/password-generator/) |

### スクリプト内に他の API キーを直書きしない

Dispatcher のコード（`scripts/_dispatcher/Code.gs`）や、Claude が生成する GAS コードに **他サービスの API キーを直書きしない** こと。スクリプトプロパティ経由で取得する設計にします。

```js
// Good
const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

// Bad
const apiKey = 'sk-xxxxxxxx';  // 直書きは NG
```

これは `.claude/gas-dispatcher.json` の運用とは独立したベストプラクティスです。

### Deploy URL を画面共有に出さない

デモや画面共有時に Apps Script の「デプロイを管理」画面を不用意に映さないでください。URL が見えれば、あとはトークンさえ推測・入手できれば攻撃可能です（トークンが十分長ければ現実には難しいですが、リスク削減の基本として）。

## Dispatcher 実行ユーザーの権限スコープ

Deploy 設定で **「実行するユーザー: 自分」** を選んでいるため、Dispatcher は **Deploy したアカウントの権限で** 動きます。

- そのアカウントが閲覧・編集できるシート全てに対して Dispatcher 経由で読み書き可能
- アカウントが所属する Google Workspace のドライブ全体にアクセスできる場合もある
- 業務用 Google アカウントで Deploy する場合は、 **付与権限の範囲を理解した上で** 運用してください

個人データと業務データが混在するアカウントでの Deploy は非推奨です。**業務データ専用アカウントを分ける** のが堅い運用。

## ローテーション手順（漏洩時 / public 化時）

以下のタイミングでは **全項目を必ず** 実施してください。

- トークンが漏洩した疑いがある
- リポジトリを public 化したい
- コラボレーターから信頼できないメンバーを外した直後
- 定期的な棚卸し（推奨: 年 1 回以上）

### 1. Deploy をアーカイブ

Apps Script エディタ → **「デプロイを管理」** → 現在の Deploy の三点メニュー → **「アーカイブ」** 。これで URL が即時に無効になります。

### 2. 新しいトークンを生成

[トークンを十分にランダム化する](#トークンを十分にランダム化する) の方法で新しい文字列を生成。旧トークンは捨てる。

### 3. スクリプトプロパティを更新

Apps Script → 歯車アイコン → スクリプト プロパティ → `SECRET_TOKEN` の値を新トークンで上書き。

### 4. 新しい Deploy を作る

「デプロイ」→「新しいデプロイ」→ ウェブアプリ（実行: 自分、アクセス: 全員）→ 新しい URL が発行される。

### 5. `.claude/gas-dispatcher.json` を更新

新しい URL + 新しいトークンで `.claude/gas-dispatcher.json` を書き換えてコミット & push。

### 6.（public 化する場合のみ）gitignore に戻す

```bash
# .gitignore に追記
.claude/gas-dispatcher.json

# ファイルを tracked から外す
git rm --cached .claude/gas-dispatcher.json
git commit -m "Stop tracking dispatcher credentials"

# 代わりに .local.json（gitignore 済）で各端末に配布
```

この状態にしてからリポジトリを public に切り替えます。

### 7.（public 化する場合のみ）git 履歴の旧トークン除去

public 化すると git 履歴の旧コミットも誰でも読めるようになります。**旧 URL + 旧トークンは Step 1 で失効させてあるので実害はありません** が、見栄え上気になる場合は `git filter-repo` や BFG で履歴から除去できます。

```bash
# git-filter-repo を使う例
pip install git-filter-repo
git filter-repo --path .claude/gas-dispatcher.json --invert-paths
git push --force origin main
```

**force push は影響が大きいので、コラボレーター全員に事前通知すること。**

## コラボレーター管理

### 追加する前に

- そのメンバーは Dispatcher のトークンと URL を知る必要があるか？
- 将来的に退職・契約終了で権限を外す可能性があるか？

信頼できないメンバーを安易に追加しない。どうしても追加する場合は、Dispatcher を分けて別アカウントで Deploy し、そのメンバー用に別リポジトリを作る設計が安全。

### 外した直後にすること

コラボレーターから外したメンバーは **コミット履歴経由でトークンと URL を知っている** 状態です。[ローテーション手順](#ローテーション手順漏洩時--public-化時) を即実施してください。

## VitePress のビルド対象

このドキュメントサイト（VitePress）のビルド対象は `docs/` 配下のみです。`.claude/gas-dispatcher.json` は公開サイト（Vercel）には含まれません。

```
.
├── .claude/                ← VitePress ビルド対象外（公開されない）
│   └── gas-dispatcher.json
├── docs/                   ← VitePress ビルド対象（公開される）
│   └── ...
├── scripts/                ← ビルド対象外
│   └── _dispatcher/
└── ...
```

ただし、リポジトリを public にすると **GitHub のファイルブラウザ経由で** 誰でも見られるようになります。Vercel ビルドに含まれる / 含まれないは関係ありません。**private リポジトリの前提が崩れた瞬間にアウト** です。

## チェックリスト

運用を始める前に以下を確認:

- [ ] リポジトリの Settings → General → Danger Zone で visibility が **Private** になっている
- [ ] `.claude/gas-dispatcher.json` の `token` が 64 文字以上のランダム文字列
- [ ] Apps Script の Deploy 設定が「実行: 自分 / アクセス: 全員」
- [ ] Dispatcher を Deploy したアカウントが業務データ専用（個人データと分離）
- [ ] 外部 API キーを使う場合は全てスクリプトプロパティで管理
- [ ] コラボレーターリストを最新の状態に整理

これらが満たせていれば、Dispatcher 方式は安全に運用できます。

---

[第 5 章: トラブル & FAQ](/guide/05-troubleshoot-faq) に戻る
