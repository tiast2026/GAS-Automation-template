# Dispatcher GAS（窓口 GAS）

Claude からのリクエストを受けて、任意のスプレッドシートを操作・コンテナバインド GAS を読み書き・トリガーを管理するための中継スクリプト。

**このリポジトリで 1 個だけデプロイ** し、以降の全シート操作はここを経由する。

## ファイル

- `Code.gs` — ディスパッチャ本体
- `appsscript.json` — マニフェスト（必要 OAuth スコープ定義）

## セットアップ

[`docs/guide/02-setup.md`](../../docs/guide/02-setup.md) を参照。所要 5 分。

## API

[`docs/appendix/dispatcher-api.md`](../../docs/appendix/dispatcher-api.md) を参照。

## 動作確認

```bash
curl -sL \
  -H 'Content-Type: application/json' \
  -d '{"action":"ping","token":"'"$GAS_DISPATCHER_TOKEN"'"}' \
  "$GAS_DISPATCHER_URL"
```

`-X POST` は付けない（302 リダイレクト後に 405 になる）。

`{ "ok": true, "result": { "pong": "...", "email": "...", "timeZone": "Asia/Tokyo" } }` が返れば成功。

## 更新の流れ

コード修正は必ず **このリポジトリが正** 。

1. リポジトリで `Code.gs` / `appsscript.json` を編集
2. GAS エディタに全文コピペ
3. 「デプロイを管理」→ 編集 → バージョン: 新規作成 → デプロイ

URL は変わらない。以降の API 呼び出しはそのまま動く。
