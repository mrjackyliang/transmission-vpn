import { NovaIdentity } from '@cbnventures/nova/toolkit';

import type { DocusaurusNovaConfig } from '@cbnventures/docusaurus-preset-nova/types/config';

/**
 * Docusaurus - Identity.
 *
 * Reads the documentation identity from the generated Nova configuration.
 * Fallbacks keep the site runnable while consumers finish project metadata.
 *
 * @since 0.0.0
 */
const identity = new NovaIdentity().forDocs();

/**
 * Docusaurus - Config.
 *
 * Configures the generated documentation site with Nova's selected preset.
 * Consumers can extend these values through normal Docusaurus configuration.
 *
 * @since 0.0.0
 */
const config: DocusaurusNovaConfig = {
  title: identity['title'] ?? '',
  titleDelimiter: '-',
  tagline: identity['tagline'] ?? 'Documentation',
  url: identity['url'] ?? 'https://www.example.com',
  baseUrl: identity['baseUrl'] ?? '/',
  favicon: './favicon.ico',
  organizationName: identity['organizationName'] ?? 'your-org',
  projectName: identity['projectName'] ?? 'transmission-vpn',
  trailingSlash: true,
  noIndex: false,
  onBrokenLinks: 'throw',

  headTags: [
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

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

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
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['**/docs/tags/**'],
          filename: 'sitemap.xml',
        },
      },

      // Search.
      search: {},
    },
  ]],

  themeConfig: {
    site: {
      logo: {
        alt: 'Transmission VPN',
        src: {
          light: `${identity['baseUrl'] ?? '/'}images/navbar.svg`,
          dark: undefined,
        },
        href: '/',
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
    navbar: {
      hideOnScroll: false,
      items: [
        {
          label: 'Overview',
          position: 'left',
          type: 'doc',
          docId: 'overview',
          icon: 'lucide:book-open',
        },
        {
          label: 'Installation',
          position: 'left',
          type: 'doc',
          docId: 'getting-started/installation',
          icon: 'lucide:rocket',
        },
        {
          label: 'Blog',
          position: 'left',
          type: undefined,
          to: '/blog/',
          icon: 'lucide:pen-line',
        },
        {
          label: 'Sponsor',
          position: 'right',
          type: undefined,
          href: 'https://github.com/sponsors/mrjackyliang',
          icon: 'lucide:heart',
        },
      ],
    },
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
    footer: {
      sections: {
        docs: [
          {
            label: 'Overview',
            href: '/docs/overview/',
          },
          {
            label: 'Installation',
            href: '/docs/getting-started/installation/',
          },
          {
            label: 'Connect to a VPN',
            href: '/docs/vpn/connecting/',
          },
          {
            label: 'Leak Protection',
            href: '/docs/vpn/leak-protection/',
          },
        ],
        project: [
          {
            label: 'Blog',
            href: '/blog/',
          },
          {
            label: 'GitHub',
            href: 'https://github.com/mrjackyliang/transmission-vpn',
          },
          {
            label: 'Transmission',
            href: 'https://transmissionbt.com/',
          },
          {
            label: 'Report an Issue',
            href: 'https://github.com/mrjackyliang/transmission-vpn/issues',
          },
        ],
        legal: [{
          label: 'License',
          href: 'https://github.com/mrjackyliang/transmission-vpn/blob/main/LICENSE',
        }],
      },
      layout: {
        docs: {
          title: 'Docs',
          section: 'docs',
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
          icon: 'ri:github-fill',
          href: 'https://github.com/mrjackyliang',
          label: 'GitHub',
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
        label: 'View on GitHub',
        href: 'https://github.com/mrjackyliang/transmission-vpn',
      },
    },
  },
};

export default config;
