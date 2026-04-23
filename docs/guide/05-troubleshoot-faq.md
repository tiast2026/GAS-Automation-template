---
prev:
  text: '第4章: 実際の使い方'
  link: '/guide/04-usage'
next: false
---

# 第5章: トラブル & FAQ

困ったときに参照する章です。症状別・質問別にまとめました。症状を `Ctrl + F` / `Cmd + F` で検索してください。

## 目次

**トラブル**

- [Dispatcher 接続エラー](#dispatcher-接続エラー)
- [Claude Code 関連](#claude-code-関連)
- [GAS 実行エラー](#gas-実行エラー)
- [GitHub 関連](#github-関連)
- [どうしても解決しないとき](#どうしても解決しないとき)

**FAQ**

- [料金について](#料金について)
- [セキュリティについて](#セキュリティについて)
- [使い方について](#使い方について)
- [運用・将来性について](#運用将来性について)
- [他方式との比較](#他方式との比較)

---

## Dispatcher 接続エラー

### `[gas-dispatcher] loaded ...` がセッション冒頭に出ない

**原因候補:**

- `.claude/gas-dispatcher.json` がリポジトリにコミットされていない
- ファイルが `main` ブランチ以外にしかない
- JSON の構文が壊れている（カンマ抜け、クォート忘れ）
- リポジトリ接続が別リポジトリになっている

**対処:**

1. GitHub の Web UI でリポジトリを開き、`.claude/gas-dispatcher.json` の存在と中身を確認
2. ブランチ切替ドロップダウンで `main` を選んでいるか確認
3. ファイルを開いて JSON が valid か目視（カンマ・クォート）
4. Claude Code のセッションに「`.claude/gas-dispatcher.json` の中身を見せて」と依頼して確認

### `unauthorized` が返ってくる

`.claude/gas-dispatcher.json` の `token` 値と、Apps Script 側のスクリプトプロパティ `SECRET_TOKEN` が一致していません。

**対処:**

1. Apps Script エディタ → 歯車アイコン → スクリプト プロパティ
2. `SECRET_TOKEN` の値を確認
3. リポジトリの `.claude/gas-dispatcher.json` と照合
4. 差があれば、どちらかに揃えて保存・コミット

### POST が「Sorry, unable to open the file at this time.」を返す

Google Drive のエラーページが返ってきます。**Dispatcher の Deploy は壊れていません** 。HTTP クライアントが Apps Script のリダイレクトを POST のまま追ってしまっている状態です。

**原因:**

Apps Script の Web App は POST を受けると 302 で `script.googleusercontent.com/macros/echo` にリダイレクトし、リダイレクト先は **GET で取りに行くのが正解** です。ところが以下の場合、リダイレクト後も POST のままアクセスしてしまいエラーになります。

- curl で `-X POST` を明示している
- Node の `fetch` / `axios` でデフォルトのリダイレクト処理に任せている
- Apps Script の `UrlFetchApp.fetch` で `followRedirects: true` のまま POST している

**対処:**

このリポジトリ同梱のヘルパー `scripts/call-dispatcher.sh` を使えば自動で回避されます。Claude Code のセッションから curl を直接書こうとしている場合は、このスクリプト経由に切り替えてください。

```bash
bash scripts/call-dispatcher.sh ping
bash scripts/call-dispatcher.sh listTabs '{"sheetId":"..."}'
```

詳しい経緯は `CLAUDE.md` の「Dispatcher 呼び出し規約」セクションを参照。

### `ping` が HTML（Google ログイン画面）を返す

デプロイのアクセス設定が「全員」以外になっています。

**対処:**

1. Apps Script → 「デプロイを管理」
2. 現在のウェブアプリ Deploy を編集
3. **アクセスできるユーザー: 全員** に設定
4. 保存して再デプロイ

### `404 Not Found`

Deploy がアーカイブされた、または URL が古い値になっています。

**対処:**

1. Apps Script で現在有効な Deploy の URL を確認
2. `.claude/gas-dispatcher.json` の `url` を正しい値に更新してコミット

### `create bound project failed` / `403 PERMISSION_DENIED`

Google Apps Script API が OFF、または OAuth スコープが不足しています。

**対処:**

1. [https://script.google.com/home/usersettings](https://script.google.com/home/usersettings) で **「Google Apps Script API」** を **ON**
2. Apps Script → 「デプロイを管理」→ 既存 Deploy をアーカイブ
3. 「新しいデプロイ」をやり直し
4. OAuth 画面で **全スコープを再承認**

### `ping` がタイムアウトする

サンドボックスの一時的なネットワーク不調のことが多いです。数秒待って再試行してください。続く場合は Apps Script 側に問題がないか、ブラウザで直接 URL + ダミーリクエストを送って応答を確認。

### コードを更新したのに反映されない

Deploy を「新しいデプロイ」で作り直すと URL が変わってしまいます。

**対処:** 「デプロイを管理」→ 既存 Deploy の右側の編集アイコン → **「バージョン: 新しいバージョン」** → デプロイ。これなら URL が同じまま新しいコードが反映されます。

---

## Claude Code 関連

### セッションを開いてもリポジトリが一覧に出ない

GitHub の Anthropic アプリにリポジトリのアクセス権限が渡っていません。

**対処:**

1. GitHub 右上アイコン → **Settings** → **Applications** → **Installed GitHub Apps**
2. Anthropic の **Configure**
3. Repository access で **All repositories** または **Only select repositories** で該当リポジトリを追加

### Web 版とスマホ版で挙動が違うように見える

中身は完全に同じです。違って見える場合、どちらかが古い git 状態を見ている可能性があります。セッションを作り直すか、「リポジトリを最新化して」と依頼してください。

### タスク実行ログが見たい

セッション UI のタスク行をクリックすると展開できます。`curl` の応答や `runScript` の生コードを確認できるので、原因切り分けに便利です。

---

## GAS 実行エラー

### `You do not have permission to call SpreadsheetApp.openById`

Dispatcher を Deploy したアカウントが、対象シートの閲覧・編集権限を持っていません。

**対処:** 対象シートを Dispatcher 実行ユーザー（Deploy したアカウント）と共有する。

### `Script function not found`

関数名のスペルミス、または対象シートにその関数が保存されていません。

**対処:** 「拡張機能 → Apps Script」で関数の有無を目視確認、Claude に「現在の関数一覧を教えて」と依頼。

### `Exceeded maximum execution time`

Apps Script の 6 分実行制限に引っかかっています。

**対処:**

- 処理を分割する（「1 回で全部」ではなく「1000 行ずつバッチで」）
- バッチ処理として設計し直す（時間トリガーで継続実行）
- 処理内容を簡素化（無駄な `getValue()` を `getValues()` にまとめる等）

Claude に「6 分制限に引っかかっています。バッチ処理に作り直してください」と依頼すると、分割版を設計してくれます。

---

## GitHub 関連

### リポジトリが private だと Claude Code は読めますか？

読めます。Claude Code は Anthropic の GitHub App 経由で private リポジトリにアクセスします（Step 2 で権限を渡したため）。

### GitHub Codespaces を使っている場合

ハーネスは通常のリポジトリクローン同様に動作します。`.claude/gas-dispatcher.json` が main にあれば、Codespace 起動時にも自動で環境変数に展開されます。

---

## どうしても解決しないとき

1. Claude Code のセッションに **エラー文をそのまま貼って** 「原因を特定して」と依頼。多くの場合、自分でログを読んで原因を指摘してくれます。
2. Apps Script エディタの「実行数」画面で直近の実行ログを確認（例外のフルスタックが見える）
3. 一旦 Dispatcher を再デプロイ（新バージョン発行）で直ることもある
4. それでも解決しない場合は、リポジトリの Issue に症状・エラーメッセージ・試した対処を書いて質問

---

## 料金について

### Q. 毎月どのくらいコストがかかる？

**A.** かかるのは **Claude のサブスク** だけです。他は無料で運用可能。

| サービス | 月額 | 必須度 |
|---|---|---|
| Claude Pro | $20 | 必須 |
| Claude Max | $100〜$200 | 大量利用時 |
| Google Workspace | $6〜/ユーザー | 業務用なら |
| GitHub Free | $0 | 必須（private リポジトリも無料） |
| Vercel Hobby | $0 | 任意（ドキュメント公開用）|

日常業務利用なら **Claude Pro 1 つ** で十分です。Dispatcher 自体は Apps Script 無料枠で動きます。

### Q. Claude Code を使いすぎると追加料金が発生する？

**A.** プラン次第。

- **Pro**: 週または月単位の使用上限あり。超えるとリセット待ち
- **Max**: 上限が大幅に引き上がる（実質無制限に近い）
- **API 経由**: トークン単位の従量課金

### Q. 無料で使えないの？

**A.** Claude Free プランでは Claude Code は使えません。Pro 以上が必要です。

---

## セキュリティについて

### Q. 接続情報をリポジトリにコミットして大丈夫？

**A.** **リポジトリが private** であれば、GitHub Secrets と同程度のアクセス制御です。以下の条件を守っていれば実用上安全です。

- リポジトリが private であり続ける
- コラボレーターは信頼できる人のみ
- トークンは十分な長さのランダム文字列（64 文字以上推奨）

public 化する場合は [付録 C: セキュリティ詳細](/appendix/security) のローテーション手順を必ず実施してください。

### Q. Dispatcher はどの権限で動く？

**A.** Deploy 時に選んだ **「実行するユーザー: 自分」** の権限で動きます。つまり、あなたの Google アカウントが見えるスプレッドシート全てに対して読み書きできる状態です。業務用アカウントで Deploy する場合は、その範囲を意識しておいてください。

### Q. 他人にシートを共有していたら、その人も Dispatcher を使える？

**A.** いいえ。Dispatcher は **Deploy したあなたの権限で動く** だけで、エンドユーザーは関係ありません。トークンが必要なので、単にシートを共有された人が勝手に呼び出すこともできません。

### Q. トークンが漏れたらどうする？

**A.** 即 Apps Script で Deploy をアーカイブ、新トークン + 新 Deploy で URL を差し替え、`.claude/gas-dispatcher.json` を更新してコミット。詳細は [付録 C](/appendix/security) を参照。

---

## 使い方について

### Q. Web 版 Claude とデスクトップ版 Claude で挙動が違う？

**A.** 違いません。同じリポジトリを開けば同じ Dispatcher を叩くので完全に等価です。

### Q. スマホからも本当に動く？

**A.** [claude.ai](https://claude.ai) のモバイル UI からセッションを開けば動作します。Dispatcher が HTTP API なので端末を選びません。

### Q. 複数の Dispatcher を切り替えたい（テスト用と本番用）

**A.** `.claude/gas-dispatcher.local.json`（`.gitignore` 済）を作ると、こちらが優先されます。個人端末で別 Deploy を叩きたい時に使ってください。

### Q. 複数人で 1 つの Dispatcher を共有したい

**A.** 原則 **1 ユーザー = 1 Dispatcher** をおすすめします。Dispatcher は実行者の Google 権限で動くため、共有すると権限まで共有されてしまいます。

どうしても共有する場合は、複数人がアクセスしてよいスコープ（特定のシート群）に限定した別アカウントで Deploy する設計が妥当です。

### Q. `clasp` は使わなくていい？

**A.** 使いません。Dispatcher 方式では HTTP でスプレッドシートと GAS を操作するので、ローカル clasp は不要です。

ただし、大規模 GAS プロジェクトをローカルで開発したい等の特殊ケースでは、その GAS プロジェクトの README に明記したうえで併用しても OK です（CLAUDE.md の方針より）。旧 clasp 方式については [付録 A](/appendix/legacy-clasp) を参照。

---

## 運用・将来性について

### Q. Dispatcher のコードを更新したい

**A.** リポジトリの `scripts/_dispatcher/Code.gs` を更新 → Apps Script エディタに貼り直し → **「デプロイを管理」→ 編集 → バージョン: 新しいバージョン** で保存。URL は変わりません。

### Q. 新しい API エンドポイントを追加したい

**A.** `scripts/_dispatcher/Code.gs` の `handlers` オブジェクトに関数を追加するだけです。Claude Code に「Dispatcher に XXX エンドポイントを追加して」と依頼すれば、コード改修 PR を起こしてくれます。

### Q. Dispatcher を落としたい（利用停止したい）

**A.** Apps Script で **「デプロイを管理」→ アーカイブ** 。URL が無効になり、Claude Code からの呼び出しは全て失敗するようになります。復活させたいときは同じプロジェクトで再 Deploy。

---

## 他方式との比較

### 旧 clasp 方式との違い

| 観点 | clasp 方式（旧） | Dispatcher 方式（現） |
|---|---|---|
| 必要ツール | Node.js + clasp | なし |
| 認証の保管 | `~/.clasprc.json` をアップロード | トークンをリポジトリにコミット |
| 端末依存 | あり（PC ごとに認証必要） | なし（リポジトリが真実の源）|
| Web/スマホ | 使いづらい | 完全対応 |
| シート ID | 都度プロンプトに貼る | URL から Dispatcher が自動抽出 |

旧方式からの移行手順は [付録 A](/appendix/legacy-clasp) を参照。

### Google Apps Script の他の運用方法との比較

| 方法 | 特徴 | Dispatcher との違い |
|---|---|---|
| Apps Script エディタ手書き | 小規模なら最速 | AI による自動化・バージョン管理がない |
| clasp + VSCode | 大規模開発向き | 端末依存・認証が重い |
| Add-on 公開 | 複数人配布に強い | 審査が必要・個人利用では過剰 |
| **Dispatcher**（このガイド）| 個人・小チーム向け | **AI と相性が最高** |

---

より詳しい API 仕様は [付録 B: Dispatcher API リファレンス](/appendix/dispatcher-api) 、セキュリティ運用の詳細は [付録 C: セキュリティ詳細](/appendix/security) にあります。
