---
prev:
  text: '第1章: 全体像'
  link: '/guide/01-overview'
next:
  text: '第3章: 動作確認'
  link: '/guide/03-verify'
---

# 第2章: セットアップ

やることは **4 つだけ** 。 **ブラウザで 3 手動作業 → Claude に 1 回指示を投げるだけ** で終わります。

<div class="action-legend">
  <div class="legend-item"><span class="legend-dot manual"></span>あなたが手でやる（ブラウザ）</div>
  <div class="legend-item"><span class="legend-dot claude"></span>Claude に丸投げ（プロンプトコピペ）</div>
  <div class="legend-item"><span class="legend-dot verify"></span>確認するだけ</div>
</div>

## 全体像

| Step | 内容 | 担当 | 目安 |
|---|---|---|---|
| 1 | GitHub で private リポジトリを作る | <span class="action-badge manual">手動</span> | 1 分 |
| 2 | Apps Script で Dispatcher を Deploy | <span class="action-badge manual">手動</span> | 5 分 |
| 3 | URL とトークンをメモ | <span class="action-badge manual">手動</span> | 30 秒 |
| 4 | Claude に登録＆疎通確認を依頼 | <span class="action-badge claude">Claude</span> | 1 分 |

::: tip 事前に揃えるもの
Google アカウント（業務用推奨）、GitHub アカウント（無料）、Claude Pro 以上のサブスクリプション。以下のリンクから登録してください。
- [GitHub サインアップ](https://github.com/signup)
- [Claude サインアップ](https://claude.ai)
:::

---

<div class="step-card manual">

## Step 1: GitHub で private リポジトリを作る <span class="action-badge manual">あなたが手でやる</span>

テンプレートリポジトリから 30 秒で作れます。

1. [https://github.com/tiast2026/GAS-Automation-template](https://github.com/tiast2026/GAS-Automation-template) を開く
2. 右上の **「Use this template」** → **「Create a new repository」**
3. リポジトリ名は任意（例: `gas-automation`）、公開範囲は **必ず Private**
4. **「Create repository」**

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  GitHub の「Use this template」ボタン → 「Create a new repository」画面
</div>

::: danger 必ず Private
この後 **Dispatcher の URL とトークンをコミット** します。Public にすると誰でもあなたのシートを操作できる状態になります。
:::

</div>

---

<div class="step-card manual">

## Step 2: Apps Script で Dispatcher を Deploy <span class="action-badge manual">あなたが手でやる</span>

ここが本作業。ブラウザで **1 往復で 5 分** 程度。

### 2-1. 空のプロジェクトを作る

1. [https://script.google.com/home](https://script.google.com/home) → 左上 **「+ 新しいプロジェクト」**
2. プロジェクト名を **`GAS Dispatcher`** に変更

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  Apps Script ホームの「+ 新しいプロジェクト」ボタン
</div>

### 2-2. コードを貼り付け

1. Step 1 で作った GitHub リポジトリを開く
2. `scripts/_dispatcher/Code.gs` を開き、右上 **「Copy raw contents」** で全文コピー
3. Apps Script に戻り、左の **`コード.gs`** をクリック → 既存を全選択削除 → 貼り付け → `Ctrl + S`（Mac は `Cmd + S`）

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  GitHub の「Copy raw contents」アイコンの位置
</div>

### 2-3. マニフェスト（appsscript.json）も貼り付け

1. Apps Script 左の **歯車アイコン**
2. **「『appsscript.json』マニフェストファイルをエディタで表示する」** にチェック
3. エディタの **`appsscript.json`** タブで、GitHub の `scripts/_dispatcher/appsscript.json` の内容を貼り付け → 保存

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  プロジェクトの設定 →「appsscript.json マニフェストを表示」のチェック
</div>

### 2-4. トークンを生成してスクリプトプロパティに登録

ブラウザの F12 → コンソールで以下を実行してコピー:

```js
crypto.randomUUID() + crypto.randomUUID()
```

Apps Script 側:

1. 歯車アイコン → 下にスクロール → **「スクリプト プロパティ」** → **「スクリプト プロパティを追加」**
2. プロパティ: `SECRET_TOKEN` 、値: 上で生成した文字列
3. **「スクリプト プロパティを保存」**

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  スクリプトプロパティに SECRET_TOKEN を追加する画面
</div>

### 2-5. Apps Script API を ON

1. [https://script.google.com/home/usersettings](https://script.google.com/home/usersettings)
2. **「Google Apps Script API」** を **ON**

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  Google Apps Script API の ON/OFF トグル画面
</div>

### 2-6. ウェブアプリとしてデプロイ

1. エディタ右上 **「デプロイ」** → **「新しいデプロイ」**
2. 左の **歯車アイコン** → **「ウェブアプリ」**
3. 設定:
   - **実行するユーザー**: **自分**
   - **アクセスできるユーザー**: **全員**（トークンで守るので OK）
4. **「デプロイ」**

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  新しいデプロイ画面（実行=自分 / アクセス=全員）
</div>

### 2-7. OAuth 同意 & URL コピー

初回のみ「アクセスを承認」が出ます。

1. Google アカウントを選ぶ
2. 「このアプリは Google で確認されていません」→ **「詳細」** → **「〜に移動（安全ではないページ）」**
3. 権限リスト → **「許可」**
4. 完了画面で表示された **ウェブアプリ URL をコピー**

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  「安全ではないページに移動」の警告画面とデプロイ完了時の URL 表示
</div>

::: tip 「安全ではない」表示について
Google が未審査の自作 GAS に対して常に出す警告です。**自分で書いた自分用の GAS なので安全** 。他人が作った GAS では絶対にやらないでください。
:::

</div>

---

<div class="step-card manual">

## Step 3: URL とトークンをメモ <span class="action-badge manual">あなたが手でやる</span>

Step 2 で得た以下 2 つを手元に控えておきます。次の Step でそのまま貼り付けます。

- **URL**: `https://script.google.com/macros/s/XXXXXXXXXXXX/exec`
- **Token**: Step 2-4 で生成したランダム文字列

</div>

---

<div class="step-card claude">

## Step 4: Claude に丸投げ <span class="action-badge claude">Claude に指示</span>

ここからはコードを書かなくて OK。 **プロンプトを 1 回投げるだけ** 。

1. [claude.ai](https://claude.ai) → 左メニューの **Code** を開く
2. **Connect GitHub** から Step 1 のリポジトリを接続（初回のみ）
3. リポジトリを選んで **New session**
4. 下をコピーして、URL と Token を実際の値に差し替えて送信:

<div class="prompt-label">📋 Claude にそのまま貼り付け</div>

```
Dispatcher を登録してください。以下の 2 つを .claude/gas-dispatcher.json
として main にコミット＆push し、そのあと ping で疎通確認までお願いします。

URL: https://script.google.com/macros/s/XXXXXXXXXXXX/exec
Token: ここに Step 2-4 で生成したトークン
```

Claude がやること:

- `.claude/gas-dispatcher.json` を作成
- `main` ブランチにコミット & push
- `ping` を叩いて、あなたの Google メアドとタイムゾーンを返答

<div class="image-slot">
  <strong>📸 画像募集中</strong>
  Claude Code が ping 成功を報告しているセッション画面
</div>

Claude が「ping 成功。メアド ◯◯、タイムゾーン Asia/Tokyo」のように返してきたら **セットアップ完了** 。

::: tip うまくいかないとき
- リポジトリが Private になっているか再確認
- URL が `/exec` で終わっているか
- Token のコピペに空白や改行が混ざっていないか
- それでもダメなら [第 5 章: トラブル & FAQ](/guide/05-troubleshoot-faq)
:::

</div>

---

## セキュリティ要点

Step 4 で **URL + トークン** をコミットしました。これを持っている人はあなたのシートを操作できます。

- リポジトリは **絶対に private 以外にしない**
- Deploy URL を画面共有・SNS に流さない
- 漏洩したら即「デプロイを管理」で古い Deploy を **アーカイブ**、新 URL + 新トークンで再デプロイ
- 詳細な運用ルールは [付録 C: セキュリティ詳細](/appendix/security)

---

## 次の章へ

環境ができたので、次は **テスト用のスプレッドシート** で読み書きが成功することを確認します。

[第 3 章: 動作確認 →](./03-verify)
