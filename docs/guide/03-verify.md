# 第 3 章: 動作確認

環境構築が終わったので、本当にシートを読み書きできることを確認します。所要時間は 2 分ほどです。

## Step 1: テスト用シートを作る

1. ブラウザの新しいタブで **[sheets.new](https://sheets.new)** を開く
   - 空の新規スプレッドシートが作成されます
2. A1 セルに **「テスト」** と入力
3. 上部の URL バーから URL をまるごとコピーする

URL は以下のような形式です。

```
https://docs.google.com/spreadsheets/d/<長いID>/edit#gid=0
```

## Step 2: Claude Code に読み取りを依頼

Claude Code の入力欄に、以下のプロンプトをそのまま貼り付けます（URL を自分のものに差し替えてください）。

```
Dispatcher の生存確認をして、その後以下のシートの A1 を読んで:
https://docs.google.com/spreadsheets/d/XXXXXXXXXXXX/edit
```

Claude Code は内部的に以下を順番に実行します。

1. `ping` エンドポイントを叩いて Dispatcher が生きているか確認
2. `readCell` で A1 セルを取得

成功すると、以下のような流れが表示されます。

```
[gas-dispatcher] POST /ping
  → {ok:true, result:{pong:true, ts:...}}

[gas-dispatcher] POST /readCell
  → {ok:true, result:{value:"テスト"}}

A1 の値は「テスト」でした。
```

A1 の値として **「テスト」** が返ってきたら、**読み取りは動いています**。

## Step 3: 書き込みを試す

続いて書き込みも試します。次のプロンプトを投げてください。

```
このシートの B1 に「動いた」と書き込んで
```

Claude Code が `writeRange` を呼び出し、完了後にスプレッドシート側のタブに戻って B1 を見てください。

- ✅ B1 に **「動いた」** と表示されていれば、書き込みも含めて完全に動作しています

これで新方式の全ての基盤が動くことが確認できました。次からは [第 4 章: 実際の使い方](./04-usage) のプロンプトテンプレをコピペして、日常業務でどんどん使い倒していけます。

---

## 失敗したときの最初のチェック

うまく動かない場合、原因の 9 割は以下のどれかです。

| 症状 | 確認ポイント |
|---|---|
| `[gas-dispatcher] loaded` が表示されない | `.claude/gas-dispatcher.json` が `main` ブランチに正しくコミットされているか |
| `ping` が `401 Unauthorized` | `gas-dispatcher.json` の `token` と Apps Script のスクリプトプロパティ `SECRET_TOKEN` が一致しているか |
| `ping` で HTML（Google ログイン画面の HTML）が返る | Deploy 時に「アクセスできるユーザー」が **「全員」** になっているか |
| `readCell` で `PERMISSION_DENIED` | 対象シートに、Dispatcher を Deploy したアカウントの編集権限があるか |
| URL が違うエラー | URL に `/edit` や `/edit#gid=0` が含まれていても OK。`docs.google.com/spreadsheets/d/...` の形式になっているか |

さらに詳細な症状別の対処は [第 5 章: トラブル & FAQ](./05-troubleshoot-faq) にまとめてあります。

## Claude Code 上でログを見る

Claude Code では、各タスクの実行ログ（リクエスト・レスポンス）をタスクカードから展開して確認できます。`ping` や `readCell` の生レスポンスを見たい場合はタスクを開いてください。

GAS 側のログ（`Logger.log` や例外スタック）を見たい場合は、以下のプロンプトを投げると Dispatcher の実行ログ API 経由で取得できます。

```
Dispatcher の直近の実行ログを見せて
```

---

次の章では、日常的によく使うプロンプトのテンプレート集を紹介します。
