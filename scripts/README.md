# scripts/

GAS プロジェクトを配置するディレクトリ。

## `_dispatcher/`（必須・固定）

このリポジトリで 1 個だけ存在する窓口 GAS。全シート操作は Dispatcher 経由で実行されるため、**この名前・場所は固定** で動かさない。

詳細: [`_dispatcher/README.md`](./_dispatcher/README.md)

## `call-dispatcher.sh`（必須・固定）

Claude Code から Dispatcher を呼び出すためのヘルパー。curl のリダイレクト挙動に関する落とし穴を吸収しているので、**Dispatcher を叩くときは必ずこれを経由する** 。

```bash
bash scripts/call-dispatcher.sh ping
bash scripts/call-dispatcher.sh listTabs '{"sheetId":"..."}'
```

詳細: [`../CLAUDE.md`](../CLAUDE.md) の「Dispatcher 呼び出し規約」セクション

## `<プロジェクト名>/`（任意）

コンテナバインド GAS のコードをリポジトリ側にバックアップしたい場合、ここに配置する。

### 命名規則

英小文字ケバブケース。例:

- `zozo-campaign-calendar/`
- `meta-ads-insights/`
- `monthly-inventory-snapshot/`
- `rakuten-api-sync/`

### 推奨構成

```
scripts/<project-name>/
├── Code.gs          メインコード（複数 .gs に分けてもよい）
├── appsscript.json  マニフェスト
└── README.md        何のスクリプトか一言メモ
```

### コンテナバインド GAS の実体は Google 側

Apps Script の実体はスプレッドシートに紐付いたコンテナバインド GAS として Google 側に存在する。このリポジトリに置くのはあくまで **バックアップ・差分レビュー用のミラー** で、Dispatcher の `writeBoundScript` が Source of Truth を Google 側に反映する。

ユーザーが「拡張機能 → Apps Script」で直接編集した場合は、次に触る前に必ず `getBoundScript` で最新を取得してから作業すること（詳細は `CLAUDE.md` 参照）。
