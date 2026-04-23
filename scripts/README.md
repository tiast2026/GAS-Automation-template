# scripts/

このディレクトリには以下を置く。

## `scripts/_dispatcher/`

Dispatcher GAS（窓口 API）本体のソース。**アンダースコアで始まる名前** は「Dispatcher 自身のソース保管庫であって、個別の業務プロジェクトではない」ことを示す。

- `Code.gs`
- `appsscript.json`
- `README.md`（Deploy 手順・OAuth スコープの説明）

これらは公式ガイドの [Step 3](https://gas-automation.vercel.app/guide/02-setup) で、ブラウザ上の Apps Script エディタにコピペする元ファイルです。

## 個別プロジェクトのバックアップ

Claude Code が `writeBoundScript` で書いたコンテナバインド GAS を、ローカルにバックアップとして残したい場合に使う。

### 命名規則

わかりやすい英小文字 + ハイフン区切り。

- `zozo-campaign-calendar/`
- `meta-ads-insights/`
- `monthly-inventory-snapshot/`

### 各サブディレクトリに置くもの

**最小構成（推奨）**

| ファイル | 役割 |
|---|---|
| `Code.gs` | メインコード（複数 `.gs` に分けて OK） |
| `appsscript.json` | マニフェスト |
| `dispatcher.json` | 対象スプレッドシート URL を記録（後述） |
| `README.md` | 何のスクリプトか一言メモ（推奨） |

**`dispatcher.json` の中身**

```json
{
  "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/XXX/edit",
  "description": "ZOZO のキャンペーン集計用、毎朝 9 時に更新"
}
```

Dispatcher はこの URL を起点にコンテナバインド GAS を特定するので、旧方式の `.clasp.json`（`scriptId` 指定）は **不要** です。

### バックアップが不要なケース

1 回限りの `runScript` 使い捨て処理で済む場合や、ごく小規模な `writeBoundScript` で完結する場合は、`scripts/<プロジェクト名>/` を作らなくても問題ありません。Claude Code のチャット履歴自体がある種の履歴になります。

継続的にメンテしたいプロジェクトだけ、ここにバックアップを残してください。

## スタンドアロン GAS（例外）

`CLAUDE.md` の方針により、スタンドアロン GAS を使うのは以下に限る:

- 複数スプレッドシートを横断する処理
- スプレッドシートに依存しないバッチ処理（BigQuery 直接操作など）
- ユーザーが明示的に「スタンドアロンで」と指定

この場合のみ、`dispatcher.json` に `scriptId` を記録する:

```json
{
  "scriptId": "1abc....",
  "description": "BigQuery 側の売上データを月次バッチで集計"
}
```
