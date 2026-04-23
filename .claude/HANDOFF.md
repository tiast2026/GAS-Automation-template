# セッション引き継ぎメモ

別セッションが立ち上がったら **まずここを読む** 。`CLAUDE.md` と合わせて最新の状況を把握できる。

Claude は作業のたびに末尾の「最新セッションのメモ」を更新し、完了したタスクは整理する。
古いメモは残さない（コミット履歴を見ればわかる）。

---

## 現在の状態（2026-04-23）

### リポジトリ構成は Dispatcher 方式（全面移行完了）

- `scripts/_dispatcher/` — 窓口 GAS（デプロイ済み）
- `scripts/call-dispatcher.sh` — HTTP 呼び出しヘルパー（必須）
- `scripts/register-sheet-script.sh` — 新規シート登録ヘルパー
- `scripts/sync-bound-scripts.sh` — bound-scripts.json → Dispatcher 同期
- `.claude/gas-dispatcher.json` — URL + トークン（private リポジトリ前提でコミット）
- `.claude/bound-scripts.json` — シート ↔ スクリプト ID マッピングの真実の源
- `docs/` — VitePress 公開ガイド（6 章 + 付録 3 本）

旧 clasp ベースは `docs/appendix/legacy-clasp.md` に歴史的記録として残してある。本編からは排除済み。

### セッション冒頭の挙動

`.claude/settings.json` の SessionStart フックが:

1. `.claude/gas-dispatcher.json`（or `.local.json`）を読んで環境変数に展開
2. `scripts/sync-bound-scripts.sh` を実行して bound-scripts を Dispatcher に同期

冒頭に `[gas-dispatcher] loaded from ...` と `[sync-bound-scripts] done (...): registered=X skipped=Y failed=Z` が出れば準備完了。

### 動作確認（疑いが出たら必ず実行）

```bash
bash scripts/call-dispatcher.sh ping
# → {"ok":true,"result":{"pong":"...","email":"...","timeZone":"Asia/Tokyo"}}

bash scripts/call-dispatcher.sh listBoundScripts
# → 登録済みシート一覧
```

### 登録済みシート

`.claude/bound-scripts.json` を参照。2026-04-23 時点では 2 件:

- `1m_slCKW-...` — 【TIASTダッシュボード】商品マスタ（メインシート）
- `1B979oeOC...` — 【スターフォーカス様】見積工数（スターフォーカス様案件、v10 の見積ツール）

---

## オープンな PR / 作業

### PR #10: docs: Dispatcher 方式への全面書き換え → **merge 済み**（commit `5ee5ef7`）

### ユーザー側で残っている作業

| 項目 | 誰が | 内容 |
|---|---|---|
| Dispatcher 再デプロイ | ユーザー | `scripts/_dispatcher/Code.gs` が更新されたので、Apps Script エディタに貼り直して「デプロイを管理 → 編集 → バージョン: 新しいバージョン → デプロイ」。URL は変わらない。新エンドポイント `bulkRegisterBoundScripts` / `scriptUrl` 対応が使えるようになる |
| 本番ドキュメントサイトの目視確認 | ユーザー | `https://gas-automation.vercel.app` が PR #10 の内容になっているか確認（merge 後 1〜2 分で反映） |

---

## 重要な制約（忘れないこと）

1. **`sheetId → scriptId` の公開 API は存在しない** 。新規シートは 1 回手動登録が必須。`scripts/register-sheet-script.sh` 経由で登録する（手順は CLAUDE.md の「コンテナバインド GAS の登録フロー」参照）
2. **Drive API を GCP プロジェクト `266692601556` で有効化済み** 。新 Dispatcher に切り替える場合は別の GCP プロジェクトで再有効化必要
3. **リポジトリは必ず private** 。`.claude/gas-dispatcher.json` にトークン入ってる
4. **Dispatcher 呼び出しは必ず `scripts/call-dispatcher.sh` 経由** 。curl 直書きで 302 リダイレクトの罠にハマる

---

## 最新セッションのメモ（作業中の Claude が更新）

### 2026-04-23 セッション（14:00〜）

**完了**:
- 【スターフォーカス様】見積工数シートを bound-scripts に登録して GAS 読み込み成功（98KB, 4 ファイル）
- Dispatcher に `scriptUrl` / `sheetUrl` 引数対応と `bulkRegisterBoundScripts` エンドポイント追加
- `.claude/bound-scripts.json` 永続化の仕組み構築
- SessionStart フックに同期ロジック追加
- CLAUDE.md に「コンテナバインド GAS の登録フロー」セクション追加
- `.github/workflows/sync-template.yml` 追加
- この HANDOFF.md 追加

**ユーザーに依頼済みで未完了**:
- Dispatcher 再デプロイ（GAS エディタでの貼り直し作業）
- 本番ドキュメントサイトの目視確認

**完了済み（このコミット時点）**:
- PR #10 merge 済み（docs 本番反映中）
- `TEMPLATE_PAT` secret 登録済み
- このコミット push がテンプレ同期 workflow を起動する（初回実行）

**次の Claude へ**: ユーザーから「再デプロイした」と連絡が来たら、`bulkRegisterBoundScripts` と `scriptUrl` 付き `registerBoundScript` の動作確認をまずやること。動作 OK ならこの HANDOFF.md の該当項目を削除。
