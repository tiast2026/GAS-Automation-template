---
layout: home

hero:
  name: "Claude Code × スプレッドシート"
  text: "ブラウザで 3 ステップ、あとは Claude に丸投げ"
  tagline: 手作業は「GitHub 連携 → Apps Script で Deploy → URL とトークンをメモ」の 3 つだけ。残りはプロンプトをコピペして Claude に投げれば完了します。
  actions:
    - theme: brand
      text: セットアップを始める
      link: /guide/02-setup
    - theme: alt
      text: 全体像から読む
      link: /guide/00-introduction
    - theme: alt
      text: GitHub
      link: https://github.com/tiast2026/GAS-Automation-template

features:
  - icon: 🟠
    title: Step 1 — GitHub で private リポ作成
    details: テンプレートから「Use this template」を押すだけ。30 秒で完了します。必ず Private で作ってください。
  - icon: 🟠
    title: Step 2 — Apps Script で Dispatcher を Deploy
    details: ブラウザだけで完結。Node.js や clasp のインストール、認証ファイルの取り扱いは一切不要です。
  - icon: 🟠
    title: Step 3 — URL とトークンをメモ
    details: Deploy が終わったら、得られた URL と自分で作ったトークンを手元に控えるだけ。
  - icon: 🟣
    title: Step 4 — Claude にプロンプトを投げる
    details: 「Dispatcher を登録して ping までお願いします」と URL・Token を添えて送るだけで、Claude がコミット・push・疎通確認まで実行します。
  - icon: 📱
    title: Web・スマホ・デスクトップ対応
    details: 認証情報を private リポにコミットするので、Claude Code をどの端末で開いてもそのまま動きます。
  - icon: 💰
    title: Claude のサブスク以外は無料
    details: GitHub・Google・Vercel は無料枠で運用可能。必要なのは Claude Pro / Max 相当のサブスクリプションだけです。
---
