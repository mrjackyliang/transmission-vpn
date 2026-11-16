import { NovaIdentity } from '@cbnventures/nova/toolkit';

import type { DocusaurusNovaConfig } from '@cbnventures/docusaurus-preset-nova/types/config';

/**
 * Identity.
 *
 * @since 0.0.0
 */
const identity = new NovaIdentity().forDocs();

/**
 * Docusaurus Configuration.
 *
 * @since 0.0.0
 */
const config: DocusaurusNovaConfig = {
  // Site Metadata.
  title: identity['title'] ?? '',
  titleDelimiter: '-',
  tagline: identity['tagline'],
  favicon: './favicon.ico',

  // Deployment.
  url: identity['url'] ?? '',
  baseUrl: identity['baseUrl'] ?? '/',
  organizationName: identity['organizationName'],
  projectName: identity['projectName'],
  deploymentBranch: undefined,
  githubHost: undefined,
  githubPort: undefined,
  trailingSlash: true,
  noIndex: false,

  // Error Handling.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  onDuplicateRoutes: 'throw',

  // Static Assets.
  staticDirectories: ['static'],
  baseUrlIssueBanner: true,
  scripts: [],
  stylesheets: [],
  clientModules: [],
  themes: [],

  // Custom Fields.
  customFields: {},

  // Head Tags.
  headTags: [
    {
      tagName: 'meta',
      attributes: {
        property: 'og:type',
        content: 'website',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: `${identity['baseUrl'] ?? '/'}apple-touch-icon.png`,
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        sizes: '96x96',
        href: `${identity['baseUrl'] ?? '/'}favicon-96x96.png`,
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/svg+xml',
        href: `${identity['baseUrl'] ?? '/'}favicon.svg`,
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'manifest',
        href: `${identity['baseUrl'] ?? '/'}site.webmanifest`,
      },
    },
  ],

  // Internationalization.
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    path: 'i18n',
    localeConfigs: {
      en: {
        label: 'English',
        direction: 'ltr',
        htmlLang: 'en-US',
        calendar: 'gregory',
        path: 'en',
      },
    },
  },

  // Markdown.
  markdown: {
    format: 'mdx',
    mermaid: true,
    emoji: true,
    mdx1Compat: {
      comments: true,
      admonitions: true,
      headingIds: true,
    },
    anchors: {
      maintainCase: false,
    },
    hooks: {
      onBrokenMarkdownLinks: 'warn',
      onBrokenMarkdownImages: 'throw',
    },
  },

  // Presets (Nova).
  presets: [[
    '@cbnventures/docusaurus-preset-nova',
    {
      // Preset Identity.
      preset: 'signal',

      // Preset Overrides (undefined = use preset default).
      overrides: {
        colors: {
          primary: {
            light: '#C5193D',
            dark: '#FE707A',
          },
          secondary: undefined,
          text: undefined,
          border: undefined,
          warning: undefined,
          danger: undefined,
        },
        fonts: {
          display: undefined,
          body: undefined,
          code: undefined,
        },
        navbar: 'compass',
        footer: 'commons',
      },

      // Plugins.
      plugins: {
        docs: {
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/mrjackyliang/transmission-vpn/tree/main/apps/docs/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
          lastVersion: 'current',
          versions: {
            current: {
              label: 'Current',
              badge: false,
              banner: 'none',
            },
          },
        },
        blog: {
          showReadingTime: true,
          blogTitle: 'Blog',
          blogDescription: 'Project updates, setup guides, and notes on keeping torrent traffic inside the VPN tunnel.',
          postsPerPage: 10,
          blogSidebarTitle: 'Recent Posts',
          blogSidebarCount: 15,
          feedOptions: {
            type: [
              'rss',
              'atom',
            ],
            copyright: identity['copyright'],
            limit: 20,
            title: 'Transmission VPN Blog',
            description: 'Project updates, setup guides, and notes on keeping torrent traffic inside the VPN tunnel.',
          },
        },
        pages: {
          editUrl: 'https://github.com/mrjackyliang/transmission-vpn/tree/main/apps/docs/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: [`${identity['baseUrl'] ?? '/'}docs/tags/**`],
          filename: 'sitemap.xml',
        },
      },

      // Analytics.
      analytics: {
        gtm: {
          containerId: 'GTM-NJN3C25S',
        },
      },

      // Search.
      search: {
        indexDocs: true,
        indexBlog: true,
        indexPages: true,
        docsRouteBasePath: 'docs',
        hashed: true,
        language: ['en'],
        highlightSearchTermsOnTargetPage: true,
        searchBarShortcutKeymap: 'mod+k',
        searchResultLimits: 8,
        fuzzyMatchingDistance: 1,
        ignorePatterns: [],
      },

      // Progress Bar.
      progressBar: true,
    },
  ]],

  // Plugins.
  plugins: [],

  // Theme Config.
  themeConfig: {
    // Site.
    site: {
      logo: {
        alt: 'Transmission VPN',
        src: {
          light: `${identity['baseUrl'] ?? '/'}images/navbar.svg`,
          dark: undefined,
        },
        href: '/',
        target: undefined,
        rel: undefined,
        ariaLabel: undefined,
        wordmark: {
          light: undefined,
          dark: undefined,
        },
      },
      image: '/thumbnails/brand.png',
      metadata: [
        {
          name: 'description',
          content: identity['metaDescription'] ?? '',
        },
        {
          name: 'twitter:card',
          content: 'summary_large_image',
        },
      ],
    },

    // Color Mode.
    colorMode: {
      defaultMode: 'system',
      disableSwitch: false,
    },

    // Navbar.
    navbar: {
      hideOnScroll: false,
      items: [
        {
          label: 'Docs',
          position: 'left',
          type: 'dropdown',
          icon: 'lucide:book-open',
          items: [
            {
              label: 'Overview',
              to: '/docs/overview/',
              icon: 'lucide:rocket',
              activeBaseRegex: '^/docs/(overview/|getting-started/|category/getting-started/|tags/)',
            },
            {
              label: 'VPN Protection',
              to: '/docs/category/vpn-protection/',
              icon: 'lucide:shield-check',
              activeBaseRegex: '^/docs/(vpn/|category/vpn-protection/)',
            },
            {
              label: 'Torrents',
              to: '/docs/category/torrents/',
              icon: 'lucide:download',
              activeBaseRegex: '^/docs/(torrents/|category/torrents/)',
            },
            {
              label: 'Configuration',
              to: '/docs/category/configuration/',
              icon: 'lucide:sliders-horizontal',
              activeBaseRegex: '^/docs/(configuration/|category/configuration/)',
            },
            {
              label: 'Remote Access',
              to: '/docs/category/remote-access/',
              icon: 'lucide:globe',
              activeBaseRegex: '^/docs/(remote-access/|category/remote-access/)',
            },
            {
              label: 'Alerts',
              to: '/docs/category/alerts/',
              icon: 'lucide:bell',
              activeBaseRegex: '^/docs/(alerts/|category/alerts/)',
            },
            {
              label: 'Operations and Troubleshooting',
              to: '/docs/category/operations-and-troubleshooting/',
              icon: 'lucide:activity',
              activeBaseRegex: '^/docs/(operations/|category/operations-and-troubleshooting/)',
            },
            {
              label: 'Reference',
              to: '/docs/category/reference/',
              icon: 'lucide:library',
              activeBaseRegex: '^/docs/(reference/|category/reference/)',
            },
            {
              label: 'Contributing',
              to: '/docs/category/contributing/',
              icon: 'lucide:code',
              activeBaseRegex: '^/docs/(contributing/|category/contributing/)',
            },
          ],
        },
        {
          label: 'Quick Start',
          position: 'left',
          type: undefined,
          to: '/docs/getting-started/installation/',
          icon: 'lucide:play',
        },
        {
          label: 'Blog',
          position: 'left',
          type: undefined,
          to: '/blog/',
          icon: 'lucide:pen-line',
        },
        {
          label: 'Resources',
          position: 'left',
          type: 'dropdown',
          icon: 'lucide:life-buoy',
          items: [
            {
              label: 'FAQ',
              to: '/docs/reference/faq/',
              icon: 'lucide:circle-help',
            },
            {
              label: 'Troubleshooting',
              to: '/docs/operations/troubleshooting/',
              icon: 'lucide:wrench',
            },
            {
              label: 'Changelog',
              href: 'https://github.com/mrjackyliang/transmission-vpn/releases',
              icon: 'lucide:history',
            },
            {
              label: 'Report an Issue',
              href: 'https://github.com/mrjackyliang/transmission-vpn/issues',
              icon: 'lucide:bug',
            },
            {
              label: 'Docker Hub',
              href: 'https://hub.docker.com/r/mrjackyliang/transmission-vpn',
              icon: 'lucide:package',
            },
          ],
        },
      ],
    },

    // Docs.
    docs: {
      versionPersistence: 'localStorage',
      sidebar: {
        hideable: false,
        autoCollapseCategories: false,
      },
    },

    // Blog.
    blog: {
      sidebar: {
        groupByYear: true,
      },
      layout: {
        heading: 'Blog',
        description: 'Project updates and setup guides',
      },
      share: {
        platforms: [
          'linkedin',
          'reddit',
          'facebook',
          'x',
          'copy',
        ],
      },
    },

    // Table of Contents.
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    },

    // Announcement Bar.
    announcementBar: undefined,

    // Back to Top Button.
    backToTopButton: true,

    // Error Pages - overrides Nova's randomized defaults with consumer copy.
    // Any unset field falls through to the Nova-flavored randomized pool.
    errorPages: {
      notFound: {
        title: 'This page was not found.',
        description: 'The page may have moved, or the link may be out of date.',
        backHomeLabel: 'Back to the overview',
        backHomeHref: '/docs/overview/',
      },
      errorPageContent: {
        title: 'This page could not be loaded.',
        retryLabel: 'Reload the page',
      },
      error: {
        retryLabel: 'Retry',
      },
    },

    // Footer.
    footer: {
      sections: {
        docs: [
          {
            label: 'Overview',
            href: '/docs/overview/',
          },
          {
            label: 'VPN Protection',
            href: '/docs/category/vpn-protection/',
          },
          {
            label: 'Torrents',
            href: '/docs/category/torrents/',
          },
          {
            label: 'Configuration',
            href: '/docs/category/configuration/',
          },
          {
            label: 'Remote Access',
            href: '/docs/category/remote-access/',
          },
          {
            label: 'Alerts',
            href: '/docs/category/alerts/',
          },
          {
            label: 'Operations and Troubleshooting',
            href: '/docs/category/operations-and-troubleshooting/',
          },
          {
            label: 'Reference',
            href: '/docs/category/reference/',
          },
          {
            label: 'Contributing',
            href: '/docs/category/contributing/',
          },
        ],
        resources: [
          {
            label: 'Blog',
            href: '/blog/',
          },
          {
            label: 'FAQ',
            href: '/docs/reference/faq/',
          },
          {
            label: 'Troubleshooting',
            href: '/docs/operations/troubleshooting/',
          },
          {
            label: 'Changelog',
            href: 'https://github.com/mrjackyliang/transmission-vpn/releases',
          },
          {
            label: 'Report an Issue',
            href: 'https://github.com/mrjackyliang/transmission-vpn/issues',
          },
          {
            label: 'Source Code',
            href: 'https://github.com/mrjackyliang/transmission-vpn',
          },
          {
            label: 'Docker Hub',
            href: 'https://hub.docker.com/r/mrjackyliang/transmission-vpn',
          },
        ],
        project: [
          {
            label: 'Sponsor',
            href: 'https://github.com/sponsors/mrjackyliang',
          },
          {
            label: 'Transmission',
            href: 'https://transmissionbt.com/',
          },
          {
            label: 'Other Projects',
            href: 'https://www.mrjackyliang.com/work/',
          },
        ],
        legal: [{
          label: 'License',
          href: 'https://github.com/mrjackyliang/transmission-vpn/blob/HEAD/LICENSE',
        }],
      },
      layout: {
        docs: {
          title: 'Docs',
          section: 'docs',
        },
        resources: {
          title: 'Resources',
          section: 'resources',
        },
        project: {
          title: 'Project',
          section: 'project',
        },
        legal: {
          title: 'Legal',
          section: 'legal',
        },
      },
      socialLinks: [
        {
          icon: 'ri:facebook-fill',
          href: 'https://www.facebook.com/jackyliangofficial',
          label: 'Facebook',
        },
        {
          icon: 'ri:twitter-x-fill',
          href: 'https://x.com/mrjackyliang',
          label: 'X',
        },
        {
          icon: 'ri:youtube-fill',
          href: 'https://www.youtube.com/@mrjackyliang',
          label: 'YouTube',
        },
        {
          icon: 'ri:instagram-fill',
          href: 'https://www.instagram.com/mrjackyliang/',
          label: 'Instagram',
        },
        {
          icon: 'ri:github-fill',
          href: 'https://github.com/mrjackyliang',
          label: 'GitHub',
        },
        {
          icon: 'ri:linkedin-fill',
          href: 'https://www.linkedin.com/in/mrjackyliang/',
          label: 'LinkedIn',
        },
        {
          icon: 'ri:reddit-fill',
          href: 'https://www.reddit.com/user/mrjackyliang/',
          label: 'Reddit',
        },
        {
          icon: 'ri:heart-fill',
          href: 'https://github.com/sponsors/mrjackyliang',
          label: 'GitHub Sponsors',
        },
      ],
      copyright: identity['copyright'],
      credit: true,
      cta: {
        label: 'Ready to keep torrents in the tunnel?',
        href: '/docs/getting-started/installation/',
      },
    },
  },
};

export default config;
