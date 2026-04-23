import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'GAS-Automation',
  description: 'Claude Code × スプレッドシート：5 分で立ち上がる GAS 自動化ガイド',
  lang: 'ja',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['meta', { name: 'theme-color', content: '#3c82f6' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'ja_JP' }],
    ['meta', { property: 'og:title', content: 'Claude Code × スプレッドシート | GAS-Automation' }],
  ],

  themeConfig: {
    nav: [
      { text: 'ホーム', link: '/' },
      { text: 'ガイド', link: '/guide/00-introduction' },
      { text: '付録', link: '/appendix/legacy-clasp' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'はじめに',
          items: [
            { text: '第0章: はじめに', link: '/guide/00-introduction' },
            { text: '第1章: 全体像', link: '/guide/01-overview' },
          ],
        },
        {
          text: 'セットアップと利用',
          items: [
            { text: '第2章: 5 分セットアップ', link: '/guide/02-setup' },
            { text: '第3章: 動作確認', link: '/guide/03-verify' },
            { text: '第4章: 実際の使い方', link: '/guide/04-usage' },
          ],
        },
        {
          text: 'サポート',
          items: [
            { text: '第5章: トラブル & FAQ', link: '/guide/05-troubleshoot-faq' },
          ],
        },
      ],
      '/appendix/': [
        {
          text: '付録',
          items: [
            { text: 'A: 旧 clasp 方式について', link: '/appendix/legacy-clasp' },
            { text: 'B: Dispatcher API リファレンス', link: '/appendix/dispatcher-api' },
            { text: 'C: セキュリティ詳細', link: '/appendix/security' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/tiast2026/GAS-Automation-template' },
    ],

    docFooter: {
      prev: '前のページ',
      next: '次のページ',
    },

    outline: {
      label: '目次',
      level: [2, 3],
    },

    editLink: {
      pattern: 'https://github.com/tiast2026/GAS-Automation-template/edit/main/docs/:path',
      text: 'このページを編集',
    },

    lastUpdated: {
      text: '最終更新',
      formatOptions: { dateStyle: 'short', timeStyle: 'short' },
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '検索', buttonAriaLabel: '検索' },
          modal: {
            noResultsText: '該当する結果がありません',
            resetButtonTitle: '条件をリセット',
            footer: { selectText: '選択', navigateText: '移動', closeText: '閉じる' },
          },
        },
      },
    },
  },
})
