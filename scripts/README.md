# scripts/

各 GAS プロジェクトをこの直下にサブディレクトリとして配置する。

## 命名規則

わかりやすい英小文字 + ハイフン区切り。例:

- `zozo-campaign-calendar/`
- `meta-ads-insights/`
- `monthly-inventory-snapshot/`

## 各サブディレクトリに置くもの

最小構成:
- `.clasp.json` … スクリプトIDを指定
- `appsscript.json` … マニフェスト
- `Code.gs` … メインコード（複数 `.gs` に分けてOK）
- `README.md` … 何のスクリプトか一言メモ（推奨）
