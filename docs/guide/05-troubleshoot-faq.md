# 第 5 章: トラブル & FAQ

困ったときに開く章です。症状別索引から目的の項目を探してください。

## 症状別索引

- [Dispatcher 接続エラー](#dispatcher-接続エラー)
- [Claude Code 関連](#claude-code-関連)
- [GAS 実行エラー](#gas-実行エラー)
- [FAQ](#faq)

---

## Dispatcher 接続エラー

| 症状 | 原因 | 対処 |
|---|---|---|
| `[gas-dispatcher] loaded` が出ない | `.claude/gas-dispatcher.json` が未コミット、または `main` 以外のブランチにある | GitHub 上で該当ファイルを確認。ブランチ切り替え中なら `main` に戻す |
| `ping` が `401 Unauthorized` | `SECRET_TOKEN` の不一致 | Apps Script スクリプトプロパティの `SECRET_TOKEN` と、`gas-dispatcher.json` の `token` を完全一致させる（前後の空白も禁止） |
| `ping` が HTML を返す（Google ログイン画面） | デプロイ時のアクセス権限が「全員」になっていない | Apps Script 右上「デプロイを管理」→ 編集（✏️）→ アクセスできるユーザーを **「全員」** に変更 |
| `ping` がタイムアウト | サンドボックスの一時的ネット障害、または GAS 側の初回ウォームアップ | 数秒待って再試行。繰り返す場合は Apps Script の実行ログを確認 |
| `404` が返る | デプロイがアーカイブされた、または URL が古い | 「デプロイを管理」で新規デプロイ → 新 URL を `gas-dispatcher.json` に更新してコミット |
| `500` で `Cannot read property ...` | `doPost` に渡った JSON のパースに失敗 | Claude Code のリクエストボディが壊れていないか。再試行で直ることが多い |
| 初回だけ権限エラー | Deploy したアカウントで認可が未承認 | Apps Script で Dispatcher の `doPost` を一度手動実行して、認可ダイアログを通す |

### デバッグチェックリスト

うまくいかないときは上から順に確認してください。

1. GitHub で `.claude/gas-dispatcher.json` が `main` ブランチに存在することを確認
2. `url` が `https://script.google.com/macros/s/.../exec` の形式であることを確認（末尾 `/exec` 必須）
3. `token` と Apps Script のスクリプトプロパティ `SECRET_TOKEN` が完全一致していることを確認
4. 「デプロイを管理」で **「アクセスできるユーザー: 全員」** になっていることを確認
5. ブラウザで URL にアクセスすると「HTTP POST 以外は受け付けません」の趣旨のエラーが返れば OK（ログイン画面が返ってきたら 4 を見直す）

---

## Claude Code 関連

### セッションが起動直後の GitHub 接続に失敗する

- GitHub アプリの認可が切れていないか確認
- リポジトリが private になっていて、Claude Code に閲覧権限が付与されているか確認

### リポジトリ一覧に目的のリポが出ない

- Claude Code の GitHub 連携設定で、該当リポジトリへのアクセスが許可されているか確認
- GitHub 側で組織所有リポジトリの場合、組織管理者の承認が必要なケースがあります

### Web 版とデスクトップ版で挙動が違うように見える

挙動は完全に等価です。Web 版の Claude Code でもデスクトップ版でも、`.claude/gas-dispatcher.json` を読んで同じ Dispatcher を叩くので、差異はありません。

もし片方だけ動かない場合は:

- `.claude/gas-dispatcher.json` の中身を GitHub の Web UI で直接確認
- ブラウザキャッシュを疑ってシークレットウィンドウで再試行

---

## GAS 実行エラー

### `PERMISSION_DENIED` / 権限エラー

- **原因 1**: Dispatcher を Deploy したアカウントが、対象スプレッドシートの編集権限を持っていない
- **対処**: スプレッドシート右上の「共有」から、Deploy したアカウントに **編集権限** を付与

- **原因 2**: 必要な OAuth スコープが `appsscript.json` にない（外部 API・Drive 操作など）
- **対処**: Claude Code に「`appsscript.json` に必要なスコープを追加して再実行して」と依頼。初回実行時に認可ダイアログが出るので承認する

### `Exceeded maximum execution time`（タイムアウト）

Apps Script は 1 回の実行に **6 分まで** という制限があります。大量データを一度に触ろうとしたときに発生します。

**対処**:

- Claude Code に「分割処理にして、続きは時間トリガーで連鎖実行するように書き換えて」と指示
- または「1000 行ずつバッチで処理して、状態を PropertiesService に保存して」と指示

### `Range not found` / タブが見つからない

- タブ名に全角スペースが混じっている、または前後に空白が入っているケースが多いです
- Claude Code に「タブ名を `listTabs` で確認してから再実行して」と指示すれば自動で修正します

### `Quota exceeded`

- 1 日の API 呼び出し上限に達したケース（無料枠: メール送信、外部 URL fetch など）
- 翌日（太平洋標準時リセット）に自動復活します

---

## FAQ

### Q. Web 版 Claude とデスクトップ版 Claude で挙動が違う？

**A.** 違いません。同じリポジトリを開けば同じ Dispatcher を叩くので、完全に等価に動作します。「デスクトップ版でないと動かない機能」は存在しません。

### Q. スマホからも本当に動く？

**A.** 動きます。[claude.ai](https://claude.ai) のモバイル UI からセッションを開けば、通常通り Dispatcher 経由でシートを操作できます。コードを書いたり修正を依頼したりする端末は選びません。

### Q. リポジトリを public にしたい場合は？

**A.** 以下の順で手順を踏んでから public 化してください。詳細は [付録 C: セキュリティ詳細](../appendix/security) にあります。

1. `.claude/gas-dispatcher.json` をリポジトリから削除
2. Apps Script で旧 Deploy をアーカイブ（URL 失効）
3. 新しい `SECRET_TOKEN` を生成 → スクリプトプロパティを上書き
4. 新規 Deploy で新 URL を発行
5. 新 URL とトークンは、ローカルの `.claude/gas-dispatcher.local.json`（gitignore 済）だけに置く

### Q. 複数の Dispatcher を使い分けられる？

**A.** できます。`.claude/gas-dispatcher.local.json` を作ると、コミット版 `.claude/gas-dispatcher.json` より **優先** されます（`.local.json` は `.gitignore` 済なのでコミットされません）。

- 本番用: `gas-dispatcher.json`（コミット、チームで共有）
- テスト用: `gas-dispatcher.local.json`（ローカル専用、自分だけ）

といった切り替えが可能です。

### Q. Dispatcher を共有する単位は？

**A.** **1 ユーザー = 1 Dispatcher** を基本としてください。Dispatcher は実行者の Google 権限で動くので、他人と共有すると、その他人がアクセスできるシート全てに対してあなたも（逆も）操作可能になります。業務上の分離が必要なら、アカウントごとに Dispatcher を立ててください。

### Q. clasp / `.clasprc.json` は使わないの？

**A.** 使いません。新方式ではブラウザで Dispatcher を Deploy するだけで完結します。旧方式のセットアップで既に clasp を入れている場合は、アンインストールしてもしなくても構いません（共存可能）。詳しくは [付録 A: 旧 clasp 方式について](../appendix/legacy-clasp) を参照してください。

### Q. Dispatcher の URL が漏れた・トークンが漏れたかもしれない

**A.** 以下を直ちに実施してください。

1. Apps Script で「デプロイを管理」→ 該当デプロイを **アーカイブ**（URL が即失効）
2. スクリプトプロパティ `SECRET_TOKEN` を新規生成して上書き
3. 新 URL で再デプロイ
4. `.claude/gas-dispatcher.json` を新 URL・新トークンで更新してコミット

これで旧認証情報では一切動かなくなります。詳細は [付録 C](../appendix/security)。

### Q. Dispatcher の料金はかかる？

**A.** かかりません。Apps Script の無料枠（個人アカウントで 1 日 90 分の実行時間、500 万セル書き込みなど）に収まる限り無料です。業務で大量データを扱っても、通常は無料枠で十分です。

### Q. ログはどこに溜まる？

**A.** Apps Script の「実行数」ページ（左側 **📊** アイコン）に、`doPost` の全実行履歴と `console.log` / `Logger.log` の出力が残ります。Claude Code から「Dispatcher の直近の実行ログを見せて」と頼むと、この内容を取得して表示できます。

### Q. 既存の GAS プロジェクト（手書きで作ったもの）と共存できる？

**A.** できます。Dispatcher は対象シートのコンテナバインド GAS にコードを **追記** する方式なので、既存の関数やトリガーを壊しません。`getBoundScript` で現状を読んでから差分マージする挙動です。

心配な場合は、Claude Code に「修正前のコードを `scripts/<プロジェクト名>/backup.gs` に保存してから作業して」と指示すれば、GitHub 側にスナップショットを残せます。

### Q. トリガーを全部消したい

**A.** 以下のプロンプトで一括削除できます。

```
以下のシートに設定されている全てのトリガーを削除して:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

Claude Code は `listTriggers` で一覧を取って確認を挟んでから `deleteTrigger` で削除します。誤操作防止のため、削除対象の一覧を表示してから実行されます。

### Q. それでも解決しない

GitHub の [Issues](https://github.com/tiast2026/GAS-Automation-template/issues) に症状を書いてください。その際、以下の情報があると解決が早いです。

- Claude Code のセッション冒頭の `[gas-dispatcher] loaded` ログ
- `ping` の生レスポンス（URL・トークンはマスクしてください）
- Apps Script の「実行数」ページのエラーメッセージ
