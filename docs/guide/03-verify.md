---
prev:
  text: '第2章: 5 分セットアップ'
  link: '/guide/02-setup'
next:
  text: '第4章: 実際の使い方'
  link: '/guide/04-usage'
---

# 第3章: 動作確認

テスト用スプレッドシートを 1 枚作り、Claude Code に「読み取り → 書き込み → 保存型の関数作成」まで依頼して、環境が正しく動くことを確認します。

所要時間: **約 5 分** 。

## ステップ

1. テスト用スプレッドシートを作成
2. Dispatcher の疎通確認
3. 読み取りを依頼
4. 書き込みを依頼
5. コンテナバインド GAS への保存を依頼
6. スプレッドシート側で実行を確認

---

## 1. テスト用スプレッドシートを作成

ブラウザで以下を開くだけで、新しいスプレッドシートが即座に作られます。

[https://sheets.new](https://sheets.new)

- 名前を `claude-code-test` に変更
- A1 に `テスト` と入力
- URL をコピー（`https://docs.google.com/spreadsheets/d/XXX/edit#gid=0` の形）

## 2. Dispatcher の疎通確認

[claude.ai/code](https://claude.ai/code) でセッションを開き、以下を送信します。

```
窓口 GAS（Dispatcher）の疎通確認をお願いします。
```

Claude が `ping` エンドポイントを叩き、以下のような応答が返ってくれば OK です。

```json
{
  "ok": true,
  "result": {
    "pong": true,
    "email": "you@example.com",
    "timeZone": "Asia/Tokyo"
  }
}
```

## 3. 読み取りを依頼

先ほどの URL を渡して読み取りを依頼します。

```
以下のシートの A1 を読んでください。
<ここにシートの URL>
```

Claude が `readCell` を使って `テスト` という値を返します。`listTabs` でタブ一覧、`describeTab` で行数・列数・ヘッダー情報も取得できます。

## 4. 書き込みを依頼

```
このシートの B1 に「動いた」と書き込んでください。
```

Claude が `writeRange` で値を書き込みます。スプレッドシートに戻って B1 に「動いた」と表示されていれば OK です。

## 5. コンテナバインド GAS への保存を依頼

使い捨て実行だけでなく、 **コードをシートに保存** できるかも確認します。

```
このシートに、A 列の文字を B 列にコピーする sayHello という関数を作って、
コンテナバインド GAS に保存してください。
```

Claude が:

1. 対象シートに新規のコンテナバインド GAS プロジェクトを作成（初回のみ）
2. `writeBoundScript` で `sayHello` 関数を書き込み
3. スクリプト ID を報告

という流れを自動実行します。

## 6. スプレッドシート側で実行を確認

スプレッドシートで **「拡張機能」→「Apps Script」** を開きます。

- 左サイドバーにプロジェクトが表示されている
- `コード.gs` に `sayHello` 関数が定義されている
- 関数を選択して **「実行」** → 初回は権限承認画面 → 承認後に実行

B 列に A 列の値がコピーされれば保存型の動作も確認完了です。

---

## うまくいかないとき

### `[gas-dispatcher] loaded ...` が出ない

`.claude/gas-dispatcher.json` が main ブランチにコミットされていない可能性があります。GitHub 上でファイルの存在と JSON の中身を確認してください。

### `unauthorized` エラー

`.claude/gas-dispatcher.json` の `token` と、Apps Script のスクリプトプロパティ `SECRET_TOKEN` が一致していません。Step 3-4 で設定した値と合っているか確認。

### HTML（ログイン画面）が返ってくる

Deploy 時のアクセス設定が「全員」以外になっています。Apps Script の「デプロイを管理」→ 編集 → **アクセス「全員」** に直してください。

### `create bound project failed` / `403 PERMISSION_DENIED`

Step 3-5 の **Google Apps Script API が OFF** のままです。[https://script.google.com/home/usersettings](https://script.google.com/home/usersettings) で ON にしたあと、Deploy を一度アーカイブ → 新規 Deploy を作り直して OAuth 画面で **全スコープ再承認** してください。

より網羅的な対処は [第 5 章: トラブル & FAQ](/guide/05-troubleshoot-faq) にあります。

---

## 次の章へ

動作確認が済んだら、 **実務で使うプロンプト集** に進みましょう。辞書的に必要なパターンを参照できます。

[第 4 章: 実際の使い方 →](./04-usage)
