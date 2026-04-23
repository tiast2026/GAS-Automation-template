# 付録 A: 旧 clasp 方式について

::: warning この付録は旧方式向けの移行ガイドです
新規ユーザーは読む必要がありません。すでに clasp ベースで環境を構築済みの方だけを対象にした歴史的な記録です。
:::

## 旧方式の概要

旧方式では、ローカル PC に Node.js と Google の公式 CLI である `clasp` をインストールし、`clasp login` によって `~/.clasprc.json` という認証ファイルを生成していました。このファイルを Claude Code のセッションに毎回アップロードすることで、Claude Code がローカルの clasp 経由で Apps Script API を叩く、という構成です。

典型的な旧ワークフロー:

1. ローカル PC に Node.js を入れる
2. `npm install -g @google/clasp` で clasp を入れる
3. `clasp login` で認証ファイルを生成
4. Claude Code のセッションごとに `~/.clasprc.json` をアップロード
5. Claude Code がシェル経由で `clasp push --force` を実行

## なぜ廃止したか

主に以下 3 点の問題がありました。

### 1. インストールの敷居が高い

非エンジニアのユーザーにとって、Node.js のインストール、PATH の設定、npm のグローバルインストールは想像以上に躓きポイントになっていました。セットアップ所要時間は 60〜90 分が標準でした。

### 2. Web 版・スマホ版の Claude で動かない

`clasp` がローカルファイルシステムを前提にしているため、ブラウザだけで動く Web Claude・スマホ Claude では原理的に使えませんでした。「外出先で PC を開かないと何もできない」という状態でした。

### 3. セッションごとの認証ファイル添付が必要

Claude Code のクラウドセッションは毎回クリーンな環境で立ち上がるため、`~/.clasprc.json` を毎セッション毎にアップロードする必要がありました。この手間が日常業務で大きなストレスでした。

## 新方式への移行手順

旧方式で構築済みの方は、以下の手順で新方式に乗り換えてください。**既存のシートや GAS プロジェクトを壊さずに移行できます**。

### Step 1: Dispatcher を Deploy

[第 2 章: 5 分セットアップ](../guide/02-setup) の Step 3〜5 をそのまま実施してください。既存リポジトリを流用しても OK です。

### Step 2: `.claude/gas-dispatcher.json` をコミット

Dispatcher の URL とトークンをリポジトリにコミットします。詳細は第 2 章 Step 4 を参照。

### Step 3: Claude Code セッションを新規起動

セッション開始時に `[gas-dispatcher] loaded` が表示されれば新方式で動いています。旧手順にあった **「`~/.clasprc.json` のアップロード」は今後一切不要** です。

### Step 4: ローカル clasp はそのままでも OK

- ローカルにインストール済みの clasp は、**アンインストールしてもしなくても構いません**
- 新方式とは独立して動作するので共存可能
- 気になる場合は `npm uninstall -g @google/clasp` で外せます

## 共存パターン：大規模 GAS プロジェクトでの clasp 併用

新方式は Dispatcher 経由で全ての操作を窓口化しますが、**大規模な GAS プロジェクトのローカル開発** では、従来通り clasp を併用したい場合があります（ローカルエディタでの多ファイル編集、IDE の補完、ユニットテストなど）。

この場合は、そのプロジェクトの README に clasp 利用を明記し、新方式と並行運用してください。`CLAUDE.md` の方針では大規模案件でのローカル開発での clasp 併用は許容されています。

```text
scripts/
├── _dispatcher/            ← 新方式（Dispatcher 本体、ブラウザ Deploy）
├── small-automation/       ← 新方式（Claude Code + Dispatcher で編集）
└── big-legacy-project/     ← 旧方式併用（ローカル clasp + Claude Code）
    └── README.md           ← 「このプロジェクトは clasp 併用」と明記
```

## 旧ドキュメントの主要な記述との対応

旧サイトで出ていた以下の記述は、新方式では全て廃止されています。

| 旧記述 | 新方式での対応 |
|---|---|
| 「Node.js をダウンロードしてインストール」 | 不要。ブラウザだけで完結 |
| 「`npm install -g @google/clasp`」 | 不要 |
| 「`clasp login` で `.clasprc.json` を生成」 | 不要。代わりに Dispatcher の `SECRET_TOKEN` を設定 |
| 「セッションごとに `.clasprc.json` をアップロード」 | 不要。`.claude/gas-dispatcher.json` をコミットして共有 |
| 「スクリプト ID をプロンプトに貼る」 | 不要。URL だけで Dispatcher が自動識別 |
| 「トリガーは Apps Script エディタから手動設定」 | Claude Code が `installTimeTrigger` / `installSheetTrigger` 経由で自動設定 |

## まとめ

旧方式を使っていた方は、10 分ほど作業すれば新方式に乗り換えられます。既存の GAS プロジェクトも壊れません。クラウドの Claude Code と Dispatcher の組み合わせが快適なので、ぜひ移行をご検討ください。
