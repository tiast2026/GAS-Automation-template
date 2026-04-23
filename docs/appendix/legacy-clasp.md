---
prev: false
next:
  text: 'B: Dispatcher API リファレンス'
  link: '/appendix/dispatcher-api'
---

# 付録 A: 旧 clasp 方式について

このガイドは 2026 年 4 月の改訂で **Dispatcher 方式** に全面移行しました。旧方式（`clasp` + `.clasprc.json` アップロード）で環境を構築済みの方向けに、経緯と移行手順を残しておきます。

::: tip この付録は歴史記録
**新規ユーザーは読まなくて OK** です。[本編のガイド](/guide/00-introduction) から進めてください。
:::

## 旧方式の概要

Claude Code のローカル環境で `clasp`（Google 公式の GAS CLI）を動かし、`clasp login` で `~/.clasprc.json` を生成。このファイルを **セッションごとに Claude Code にアップロード** して、Claude がローカルから GAS を `clasp push` する構成でした。

登場人物は以下の 4 つ。

- あなた
- Claude Code
- `clasp`（ローカル CLI）
- GitHub

## 廃止理由

1. **インストール負担が重い**: Node.js → npm → clasp → Google API 有効化、と手順が長く、非エンジニアには難しい
2. **Web / スマホ対応不可**: `~/.clasprc.json` を毎回アップロードする必要があり、モバイル UI では困難
3. **端末依存**: PC ごとに `clasp login` をやり直す必要があった
4. **clasp 3.x でのワークフロー変更**: `clasp run` が GCP プロジェクト紐付け必須になり、従来フローが壊れた

Dispatcher 方式に移行することで、 **ブラウザ 1 つで全環境完結** かつ Web/スマホでも動くようになりました。

## 旧方式から新方式への移行手順

既に `clasp` ベースで構築済みの環境からの移行は以下の手順で実施します。

### 1. Dispatcher を Deploy

[第 2 章](/guide/02-setup) の手順でブラウザから Apps Script に Dispatcher をデプロイ。

既存の GAS プロジェクトとは別に、**1 個だけ** Dispatcher 専用のプロジェクトを作ります。

### 2. 接続情報をコミット

`.claude/gas-dispatcher.json` に URL + トークンを書いてコミット。

### 3. 既存コードを維持

既にコンテナバインド GAS でシートに書き込み済みのコードは **そのまま使えます** 。Dispatcher は `getBoundScript` / `writeBoundScript` で既存のコンテナバインド GAS を読み書きできるので、移行作業で GAS コードを失うことはありません。

### 4. ローカルの `clasp` をどうするか

以下のどちらでも OK です。

- **そのまま残す**: `clasp` は個別プロジェクトで併用可能（後述）
- **アンインストール**: `npm uninstall -g @google/clasp` 、`~/.clasprc.json` も削除して良い

Claude Code 側の設定（`CLAUDE.md` や `.claude/settings.json`）からは `clasp` 関連の記述を新テンプレートに合わせて削除してください（本リポジトリの最新版で対応済み）。

### 5. `.clasprc.json` のアップロードをやめる

新方式では **セッションごとの認証アップロードは不要** です。これまでセッション冒頭で実施していた作業は全てスキップ可能。

## Dispatcher と `clasp` の併用

以下のような特殊ケースでは、`clasp` との併用が理にかなうことがあります。

- 大規模 GAS プロジェクトのローカル開発（IDE 補完や Git 差分を活用したい）
- 既存のテスト基盤が `clasp push` 前提
- オフライン環境で編集したい

併用する場合は、その GAS プロジェクトの `README.md` に「このプロジェクトは clasp 併用です」と明記し、チーム内で合意を取ってください（CLAUDE.md の方針より）。

## clasp 3.x 対応早見表

旧 clasp 2.x → 3.x のコマンド対応表。移行が必要な方向け。

| 用途 | 2.x | 3.x |
|---|---|---|
| 認証確認 | `clasp login --status` | `clasp show-authorized-user` |
| エディタを開く | `clasp open` | `clasp open-script` |
| 関数実行 | `clasp run` | **使用不可**（要 GCP 紐付け）→ エディタで手動実行 |
| ログ確認 | `clasp logs` | `clasp logs`（同じ）|
| プッシュ | `clasp push --force` | `clasp push --force`（同じ）|

`clasp run` が使えなくなったことが最大の変更点。トリガーか Apps Script エディタで手動実行になります。

## 参考: 旧ガイドの構成

参考までに、旧ガイドは 10 章構成で以下の順で解説していました。

- 第 0〜1 章: はじめに・全体像
- 第 2 章: アカウント準備
- 第 3 章: ローカル PC 環境（Node.js・clasp）
- 第 4 章: GitHub リポジトリ
- 第 5 章: Claude Code セットアップ（`.clasprc.json` アップロード）
- 第 6 章: 動作確認
- 第 7 章: 実際の使い方
- 第 8 章: トラブルシュート
- 第 9 章: FAQ

現在の 6 章構成（0〜5 章）は、この旧構成の第 2〜5 章を 1 つの「5 分セットアップ」章に圧縮した形です。

---

[本編: 第 0 章 はじめに](/guide/00-introduction) に戻る
