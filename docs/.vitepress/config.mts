import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Claude Code × スプレッドシート GAS 自動化ガイド',
  description: '窓口 GAS（Dispatcher）方式で、ブラウザだけで立ち上がるスプレッドシート自動化環境の構築ガイド',
  lang: 'ja-JP',

  head: [
    ['meta', { name: 'theme-color', content: '#646cff' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'ja_JP' }],
  ],

  themeConfig: {
    siteTitle: 'GAS 自動化ガイド',
    logo: '/images/logo.svg',

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
          ]
        },
        {
          text: 'セットアップと利用',
          items: [
            { text: '第2章: 5 分セットアップ', link: '/guide/02-setup' },
            { text: '第3章: 動作確認', link: '/guide/03-verify' },
            { text: '第4章: 実際の使い方', link: '/guide/04-usage' },
          ]
        },
        {
          text: 'サポート',
          items: [
            { text: '第5章: トラブル & FAQ', link: '/guide/05-troubleshoot-faq' },
          ]
        },
      ],
      '/appendix/': [
        {
          text: '付録',
          items: [
            { text: 'A: 旧 clasp 方式について', link: '/appendix/legacy-clasp' },
            { text: 'B: Dispatcher API リファレンス', link: '/appendix/dispatcher-api' },
            { text: 'C: セキュリティ詳細', link: '/appendix/security' },
            { text: 'D: セミナー資料 (Claude × GitHub × Vercel)', link: '/appendix/seminar' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/tiast2026/GAS-Automation-template' }
    ],

    footer: {
      message: 'MIT License',
      copyright: 'Copyright © 2026'
    },

    search: {
      provider: 'local'
    },

    outline: {
      label: 'このページの目次',
      level: [2, 3]
    },

    docFooter: {
      prev: '前のページ',
      next: '次のページ'
    },

    lastUpdated: {
      text: '最終更新',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    }
  }
})
