# 第 4 章: 実際の使い方

ここはプロンプトテンプレ集です。コピペしてそのまま使えます。URL は必ず自分のシートのものに差し替えてください。

::: tip プロンプトのコツ
- URL は完全な形で渡す（`https://docs.google.com/spreadsheets/d/.../edit` 形式）
- 大量データを扱うときは「先頭 50 行を見て構造を把握してから」と指示すると効率的
- 破壊的操作（タブ削除・全クリア）は Claude Code が **事前に確認** を入れる仕様です。いきなり消えることはありません
:::

---

## 1. 読み取り（集計・要約）

シートの中身を読んで、集計結果やサマリを日本語で返してもらう最もシンプルな使い方。

**プロンプト例**

```
以下のシートの「売上」タブを集計して、月別の合計と上位 5 商品を教えて:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `listTabs` でタブ一覧を取得
2. `describeTab` で「売上」タブの列構成を把握
3. `readTab` で値を取得
4. 集計してチャットに結果を返す

**確認方法**: チャット上に集計結果が出力されます。シート側には変更を加えません。

---

## 2. 使い捨て処理（一回限りのバッチ）

「今だけ」「この瞬間だけ」動いてほしいワンショットの整形・変換処理。コードは保存されません。

**プロンプト例**

```
A 列の値を重複排除して、B 列に先頭から順に並べて:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `runScript` でその場限りの JavaScript を送信 → Dispatcher が `eval` 実行
2. Dispatcher が結果のセル書き込みまで済ませて返す

**確認方法**: シートを開いて B 列を確認。

---

## 3. 保存型ロジック（継続的に使う関数）

何度も呼びたい関数は、スプレッドシートのコンテナバインド GAS に **保存** しておきます。後からシート側で「拡張機能 → Apps Script」を開いて確認・手修正も可能です。

**プロンプト例**

```
このシートに「月次集計関数」を保存して、後からいつでも実行できるようにして:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `getBoundScript` で既存コードを取得（あれば）
2. `writeBoundScript` で新しい関数を追加（既存コードを上書きせずマージ）
3. 動作確認として一度呼び出し

**確認方法**: シートの「拡張機能 → Apps Script」を開くと、コードが格納されていることが確認できます。

---

## 4. メニュー追加（シートに独自ボタン）

スプレッドシートの上部メニューに「◯◯を実行」ボタンを追加したいとき。シートを開き直す or `onOpen` を発火させると表示されます。

**プロンプト例**

```
シートのメニューに「集計実行」ボタンを追加して、押したら「月次集計」関数が走るようにして:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `writeBoundScript` で `onOpen()` と対象関数を保存
2. `runScript` で `onOpen()` を即実行（次回リロード前にメニューを表示）

**確認方法**: シートをリロード → 上部メニューバーに独自メニューが現れることを確認。

---

## 5. 時間トリガー（毎朝 9 時に自動実行）

特定の時刻に自動実行してほしいとき。

**プロンプト例**

```
毎朝 9 時に「在庫」タブを最新化するトリガーを設定して:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `writeBoundScript` で更新処理を保存
2. `installTimeTrigger` で毎日 9 時にトリガー設定

**確認方法**: シートの「拡張機能 → Apps Script」→ 左側の **🕒 トリガー** アイコンでトリガー一覧を確認。翌朝、在庫タブが更新されていることを確認。

---

## 6. 編集トリガー（列が編集されたら別列を更新）

セル編集を検知して自動処理を走らせたい場合。

**プロンプト例**

```
A 列が編集されたら、同じ行の B 列に現在日時を自動で入れるようにして:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `writeBoundScript` で `onEdit(e)` を保存
2. `installSheetTrigger` でイベント種別 `EDIT` のトリガーを設定

**確認方法**: シート上の A 列を編集すると、B 列にタイムスタンプが入ることを確認。

---

## 7. 既存 GAS の取り込み（機能追加）

すでにコンテナバインド GAS にコードがある場合、それを読んでから機能追加するパターン。

**プロンプト例**

```
このシートの「拡張機能 → Apps Script」にすでにコードがあるので、内容を確認した上で「CSV 出力」機能を追加して:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `getBoundScript` で既存コードを取得
2. 差分をマージしたコードを組み立てる
3. `writeBoundScript` で保存

**確認方法**: Apps Script エディタで差分を確認。新しい関数が追加されていて、既存関数は残っていることを確認。

---

## 8. エラー修正（ログを見て直して）

実行したらエラーが出た場合、Claude Code にログを取らせて直させます。

**プロンプト例**

```
月次集計を実行したらエラーが出ました。ログを見て原因を特定して、修正して再実行して:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `getBoundScript` で現状のコード取得
2. Dispatcher のログ取得 API でスタックトレース確認
3. 該当行を修正して `writeBoundScript`
4. `runScript` で再実行

**確認方法**: 修正後のコードが動くこと、シートの期待列に結果が入ることを確認。

---

## 9. 複数シート横断

別々のスプレッドシートのデータを突き合わせるタイプ。

**プロンプト例**

```
以下のシート A のユーザー ID と、シート B の購買履歴を突合して、シート C の「統合」タブに書き込んで:
シートA: https://docs.google.com/spreadsheets/d/AAAA/edit
シートB: https://docs.google.com/spreadsheets/d/BBBB/edit
シートC: https://docs.google.com/spreadsheets/d/CCCC/edit
```

**Claude Code の内部動作**

1. 各シートを `readTab` で取得
2. メモリ上で join
3. シート C に `writeRange` で結果を書き込む

**確認方法**: シート C の「統合」タブに結果が入っていることを確認。

---

## 10. 外部 API 連携（BigQuery など）

スプレッドシートの外にあるデータソースを引きたいとき。例えば BigQuery のテーブルを直接引き、シートに書き込む。

**プロンプト例**

```
BigQuery のデータセット `my_dataset` のテーブル `sales` を引いて、先月分だけをこのシートの「先月売上」タブに書き込んで:
https://docs.google.com/spreadsheets/d/XXXX/edit
```

**Claude Code の内部動作**

1. `writeBoundScript` で BigQuery サービスを使う関数を保存（`appsscript.json` に BigQuery スコープを追加）
2. `runScript` で実行

**確認方法**: シートの「先月売上」タブにデータが書き込まれていることを確認。初回は BigQuery API の利用許可ダイアログが出ることがあります。

::: tip 外部 API の OAuth スコープ
外部 API を呼ぶ関数を保存したとき、Claude Code は `appsscript.json` の `oauthScopes` を自動で調整します。初回実行時は Google から追加権限を求められるので、スプレッドシート上で実行して承認してください。
:::

---

## プロンプト作成のヒント

### URL は完全形で

`docs.google.com/spreadsheets/d/.../edit` の形式で渡してください。短縮 URL やスクリーンショットを貼っても Claude Code は処理できません。

### 「確認してから」を挟む

破壊的操作（全消去・タブ削除・大量行の上書き）は、以下のように二段階で指示すると安全です。

```
まず「旧データ」タブの内容を読んで構造を教えて。
問題なさそうならその後、全クリアして新しいデータを入れて。
```

### 大量データは段階的に

10 万行超のデータを一気に触らせると Apps Script の 6 分タイムアウトに引っかかります。

```
A 列の 1 〜 5000 行だけを対象に集計して。
結果が良さそうなら、5001 〜 10000 行も同じロジックで処理して。
```

と段階的に指示するか、Claude Code に「ループで分割してトリガーチェーンで処理して」と任せれば自動でバッチ処理化します。
