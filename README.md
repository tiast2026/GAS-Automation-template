# GAS-Automation Template

**Claude Code × Google Apps Script (GAS)** でスプレッドシート自動化を進めるためのテンプレートリポジトリです。
スプレッドシート URL を Claude Code に投げるだけで、`.gs` コード生成 → `clasp push` → デバッグ → `git commit` まで自動で回る運用に最適化されています。

公式ガイド: **https://gas-automation.vercel.app**

## このテンプレートの目的

- クライアント / プロジェクト単位で本テンプレートを複製し、「そのクライアント専用の GAS 自動化ハブ」として使う
- 各スプレッドシート用の GAS コードを `scripts/<プロジェクト名>/` 配下に積み上げる
- 手動での `clasp` 操作は最小限。Claude Code に日本語で依頼すればコードが反映される

## 使い方

### 1. リポジトリを複製する

このページ右上の **「Use this template」 → 「Create a new repository」** を押して、あなた（またはあなたの組織）のアカウント配下に新しいリポジトリを作成してください。

> クライアント固有のスクリプト ID やスプレッドシート ID が含まれるため、**Private リポジトリを推奨** します。

### 2. 複製後にやること

1. **Claude Code にリポジトリを接続** — Claude Code（claude.ai/code）から、作成したリポジトリをワークスペースとして追加する
2. **`~/.clasprc.json` をアップロード** — ローカルで `clasp login` 済みの認証ファイルを Claude Code の実行環境にアップロードする。これで `clasp push` が認証付きで動く
3. **スプレッドシート URL を Claude Code に渡す** — あとは `CLAUDE.md` に書かれたワークフロー通り、Claude Code が自動で進める

詳しい手順は公式ガイドサイトを参照してください。特に以下の章から読み始めるのがおすすめです。

- 第4章: GitHub リポジトリの作成
- 第5章: Claude Code のセットアップ

→ **https://gas-automation.vercel.app**

## ファイル構成

| ファイル / ディレクトリ | 役割 |
|---|---|
| `CLAUDE.md` | Claude Code への指示書（自動化ワークフロー・コーディング規約・コミット規約） |
| `.claude/settings.json` | Claude Code の許可コマンド設定（`clasp` / `git` 等を自動実行可能にする） |
| `.gitignore` | `.clasprc.json` など機密ファイルをコミットから除外 |
| `scripts/` | 各 GAS プロジェクトを配置するディレクトリ（詳細は `scripts/README.md`） |

## セキュリティ

- `.clasprc.json`（clasp の認証トークン）は **絶対にコミットしない** — `.gitignore` で除外済み
- API キーは `.gs` ファイルに直書きせず、`PropertiesService.getScriptProperties()` から取得する
- Private リポジトリでの運用を推奨

## ライセンス

MIT
