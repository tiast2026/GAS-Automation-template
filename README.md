# GAS-Automation Template

Claude Code × スプレッドシート GAS 自動化のテンプレートリポジトリです。

**Dispatcher GAS 方式（ブラウザだけで 5 分セットアップ）** を前提にした構成になっています。

## 使い方

1. リポジトリ右上の **「Use this template」** → **「Create a new repository」** から **private** で複製
2. 公式ガイドサイトの [第 2 章: 5 分セットアップ](https://gas-automation.vercel.app/guide/02-setup) に従って:
   - Dispatcher GAS をブラウザで Deploy
   - `.claude/gas-dispatcher.json` を `main` ブランチにコミット
3. Claude Code で複製したリポジトリを開き、スプレッドシート URL を投げるだけ

**ガイドサイト**: <https://gas-automation.vercel.app>

PC へのインストール作業（Node.js / npm / CLI 等）は **一切不要** です。

## このテンプレートに含まれるもの

| ファイル / ディレクトリ | 役割 |
|---|---|
| `CLAUDE.md` | Claude Code への指示書（Dispatcher 経由でシートを操作するワークフロー） |
| `.claude/settings.json` | Claude Code の権限設定 + SessionStart フック |
| `.claude/load-dispatcher.sh` | セッション開始時に `.claude/gas-dispatcher.json` を読み込むフックスクリプト |
| `.gitignore` | 認証ファイル（`*.local.json`）や VitePress ビルド成果物を除外 |
| `scripts/_dispatcher/` | Dispatcher GAS 本体のソース（ブラウザで Deploy する元） |
| `scripts/` | 各 GAS プロジェクトの置き場（バックアップ用途） |
| `docs/` | VitePress で公開するガイドサイト（Vercel でビルド） |

## 最初にやること（複製後）

1. `.claude/gas-dispatcher.json` を作成して `main` にコミット（[Step 4 手順](https://gas-automation.vercel.app/guide/02-setup)）
2. Claude Code で本リポジトリを接続して新規セッションを開始
3. セッション冒頭に `[gas-dispatcher] loaded ...` が表示されれば成功

## ローカル開発（docs サイトのプレビュー用のみ）

ドキュメントサイトの修正をローカルでプレビューしたい場合のみ以下が必要です。日常運用では不要です。

```bash
npm install
npm run docs:dev
```

## セキュリティ

- リポジトリは **必ず private** にしてください。public にすると、コミットされた Dispatcher URL + トークンが外部に露出します
- 万が一漏洩した場合のローテ手順は [付録 C: セキュリティ詳細](https://gas-automation.vercel.app/appendix/security) を参照

## ライセンス

MIT
