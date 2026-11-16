import {
  BlogPreview,
  BrowserFrame,
  Canvas,
  Features,
  Showcase,
  Spotlight,
} from '@cbnventures/docusaurus-preset-nova/blocks';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import ThemedImage from '@theme/ThemedImage';
import { useEffect, useState } from 'react';

import remoteAppsOneDark from '../../docs/remote-access/_assets_/remote-apps-1-dark.png';
import remoteAppsOneLight from '../../docs/remote-access/_assets_/remote-apps-1-light.png';
import managingTorrentsOneDark from '../../docs/torrents/_assets_/managing-torrents-1-dark.png';
import managingTorrentsOneLight from '../../docs/torrents/_assets_/managing-torrents-1-light.png';
import connectionsOneDark from '../../docs/vpn/_assets_/connections-1-dark.png';
import connectionsOneLight from '../../docs/vpn/_assets_/connections-1-light.png';
import styles from './index.module.css';

import type {
  Pages_Index_Home_DownloadComplete,
  Pages_Index_Home_DownloadPercent,
  Pages_Index_Home_DownloadRestarting,
  Pages_Index_Home_DownloadStep,
  Pages_Index_Home_DownloadStepState,
  Pages_Index_Home_ReducedMotion,
  Pages_Index_Home_Returns,
  Pages_Index_Home_SetDownloadStep,
  Pages_Index_Home_Timer,
} from '../types/pages/index.d.ts';

/**
 * Pages - Home.
 *
 * Landing page that composes the hero with a VPN status panel, the feature grid,
 * and the blog preview using theme blocks.
 *
 * @constructor
 *
 * @returns {Pages_Index_Home_Returns}
 *
 * @since 0.0.0
 */
function Home(): Pages_Index_Home_Returns {
  const downloadStepState: Pages_Index_Home_DownloadStepState = useState<Pages_Index_Home_DownloadStep>(0);
  const downloadStep: Pages_Index_Home_DownloadStep = downloadStepState[0];
  const setDownloadStep: Pages_Index_Home_SetDownloadStep = downloadStepState[1];

  // One step every 500 ms: the download climbs from 62% to 100% (steps 0 to 38), seeds for a
  // few seconds, fades out at step 45, resets its bar while hidden at step 46, then starts over.
  useEffect(() => {
    const reducedMotion: Pages_Index_Home_ReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion === true) {
      return undefined;
    }

    const timer: Pages_Index_Home_Timer = setInterval(() => {
      setDownloadStep((previousStep) => ((previousStep >= 46) ? 0 : previousStep + 1));

      return undefined;
    }, 500);

    return () => {
      clearInterval(timer);

      return undefined;
    };
  }, [setDownloadStep]);

  const downloadRestarting: Pages_Index_Home_DownloadRestarting = downloadStep >= 45;
  const downloadPercent: Pages_Index_Home_DownloadPercent = (downloadStep >= 46) ? 62 : Math.min(62 + downloadStep, 100);
  const downloadComplete: Pages_Index_Home_DownloadComplete = downloadPercent === 100;

  return (
    <Layout description={translate({
      id: 'home.layout.description',
      message: 'Run Transmission behind a verified OpenVPN or WireGuard tunnel in one Docker container, with a fail-closed firewall, built-in provider lists, and a web interface.',
      description: 'Front page layout description (meta description for SEO)',
    })}
    >
      <Head>
        <title>
          {translate({
            id: 'home.head.title',
            message: 'Transmission VPN - Transmission Behind a Verified VPN Tunnel',
            description: 'Front page browser tab title',
          })}
        </title>
      </Head>
      <Canvas container="full" className={styles['hero']}>
        <div className={styles['hero-inner']}>
          <div className={styles['hero-content']}>
            <p className="nova-hero-eyebrow">
              {translate({
                id: 'home.hero.eyebrow',
                message: 'Docker Image',
                description: 'Front page hero eyebrow above the heading',
              })}
            </p>
            <Heading as="h1" className="nova-hero-heading">
              {translate({
                id: 'home.hero.heading',
                message: 'A familiar Transmission experience, secured behind a VPN.',
                description: 'Front page hero main heading',
              })}
            </Heading>
            <p className="nova-hero-tagline">
              {translate({
                id: 'home.hero.tagline',
                message: 'Transmission 4.1, OpenVPN or WireGuard, and a web interface in one container. A fail-closed firewall keeps torrent traffic inside a verified tunnel, even while it reconnects.',
                description: 'Front page hero tagline beneath the heading',
              })}
            </p>
            <div className={`nova-hero-actions ${styles['hero-actions']}`}>
              <Link
                className="nova-cta-primary"
                to="/docs/getting-started/installation/"
              >
                {translate({
                  id: 'home.hero.ctaLabel',
                  message: 'Get Started',
                  description: 'Front page hero primary call-to-action button label',
                })}
              </Link>
              <Link
                className="nova-cta-secondary"
                to="/docs/overview/"
              >
                {translate({
                  id: 'home.hero.secondaryCtaLabel',
                  message: 'Learn More',
                  description: 'Front page hero secondary call-to-action button label',
                })}
              </Link>
            </div>
          </div>
          <div className={styles['vpn-panel']} aria-hidden="true">
            <p className={styles['vpn-panel-title']}>VPN</p>
            <dl className={styles['vpn-details']}>
              <div className={styles['vpn-detail']}>
                <dt className={styles['vpn-detail-label']}>Status</dt>
                <dd className={styles['vpn-detail-value']}>
                  <span className={styles['vpn-status']}>
                    <span className={styles['vpn-status-dot']} />
                    Protected
                  </span>
                </dd>
              </div>
              <div className={styles['vpn-detail']}>
                <dt className={styles['vpn-detail-label']}>Tunnel</dt>
                <dd className={styles['vpn-detail-value']}>OpenVPN</dd>
              </div>
              <div className={styles['vpn-detail']}>
                <dt className={styles['vpn-detail-label']}>Interface</dt>
                <dd className={styles['vpn-detail-value']}>tun0</dd>
              </div>
              <div className={styles['vpn-detail']}>
                <dt className={styles['vpn-detail-label']}>Provider</dt>
                <dd className={styles['vpn-detail-value']}>Northwind VPN</dd>
              </div>
              <div className={styles['vpn-detail']}>
                <dt className={styles['vpn-detail-label']}>Endpoint</dt>
                <dd className={styles['vpn-detail-value']}>toronto.northwind.example:1194 (udp)</dd>
              </div>
              <div className={styles['vpn-detail']}>
                <dt className={styles['vpn-detail-label']}>Pool</dt>
                <dd className={styles['vpn-detail-value']}>1 of 3, ordered</dd>
              </div>
              <div className={styles['vpn-detail']}>
                <dt className={styles['vpn-detail-label']}>Firewall</dt>
                <dd className={styles['vpn-detail-value']}>Tunnel only</dd>
              </div>
            </dl>
            <ul className={styles['torrent-list']}>
              <li className={(downloadRestarting === true) ? `${styles['torrent']} ${styles['torrent-restarting']}` : styles['torrent']}>
                <span className={styles['torrent-name']}>ubuntu-24.04.2-desktop-amd64.iso</span>
                <span className={(downloadComplete === true) ? `${styles['torrent-state']} ${styles['torrent-state-seeding']}` : styles['torrent-state']}>
                  {(downloadComplete === true) ? 'Seeding' : `Downloading ${downloadPercent}%`}
                </span>
                <span className={styles['torrent-progress']}>
                  <span className={(downloadComplete === true) ? `${styles['torrent-progress-value']} ${styles['torrent-progress-value-seeding']}` : styles['torrent-progress-value']} style={{ width: `${downloadPercent}%` }} />
                </span>
              </li>
              <li className={styles['torrent']}>
                <span className={styles['torrent-name']}>debian-13.1.0-amd64-DVD-1.iso</span>
                <span className={`${styles['torrent-state']} ${styles['torrent-state-seeding']}`}>Seeding</span>
                <span className={styles['torrent-progress']}>
                  <span className={`${styles['torrent-progress-value']} ${styles['torrent-progress-value-seeding']}`} style={{ width: '100%' }} />
                </span>
              </li>
            </ul>
          </div>
        </div>
      </Canvas>
      <main>
        <Features
          items={[
            {
              icon: 'lucide:shield-check',
              title: translate({
                id: 'home.features.failClosed.title',
                message: 'Fail-Closed by Design',
                description: 'Front page Features card title for Fail-Closed by Design',
              }),
              description: translate({
                id: 'home.features.failClosed.description',
                message: 'Transmission is blocked until the tunnel passes its checks and again the moment the tunnel stops or restarts, and DNS stays inside the tunnel. No setting turns this off.',
                description: 'Front page Features card description for Fail-Closed by Design',
              }),
            },
            {
              icon: 'lucide:bell',
              title: translate({
                id: 'home.features.notifications.title',
                message: 'Notifications',
                description: 'Front page Features card title for Notifications',
              }),
              description: translate({
                id: 'home.features.notifications.description',
                message: 'Get an alert on ntfy, Telegram, email, and eight other services when the VPN drops or comes back, a torrent finishes or fails, or sign-in is locked.',
                description: 'Front page Features card description for Notifications',
              }),
            },
            {
              icon: 'lucide:server',
              title: translate({
                id: 'home.features.providers.title',
                message: 'Providers Built In',
                description: 'Front page Features card title for Providers Built In',
              }),
              description: translate({
                id: 'home.features.providers.description',
                message: 'Download the official server lists for PureVPN, Private Internet Access, IPVanish, NordVPN, Surfshark, IVPN, and Mullvad, or upload your own OpenVPN profile or WireGuard file.',
                description: 'Front page Features card description for Providers Built In',
              }),
            },
            {
              icon: 'lucide:list-ordered',
              title: translate({
                id: 'home.features.endpointPools.title',
                message: 'Endpoint Pools',
                description: 'Front page Features card title for Endpoint Pools',
              }),
              description: translate({
                id: 'home.features.endpointPools.description',
                message: 'Line up to 128 endpoints in order, so one unreachable server doesn\'t stop a new connection.',
                description: 'Front page Features card description for Endpoint Pools',
              }),
            },
            {
              icon: 'lucide:sliders-horizontal',
              title: translate({
                id: 'home.features.interfaceSettings.title',
                message: 'Settings in the Interface',
                description: 'Front page Features card title for Settings in the Interface',
              }),
              description: translate({
                id: 'home.features.interfaceSettings.description',
                message: 'Providers, credentials, and Transmission settings live in the web interface, not in long lists of environment variables.',
                description: 'Front page Features card description for Settings in the Interface',
              }),
            },
            {
              icon: 'lucide:smartphone',
              title: translate({
                id: 'home.features.remoteApps.title',
                message: 'Remote Apps',
                description: 'Front page Features card title for Remote Apps',
              }),
              description: translate({
                id: 'home.features.remoteApps.description',
                message: 'An optional, password-protected RPC route lets third-party Transmission apps connect from your private network.',
                description: 'Front page Features card description for Remote Apps',
              }),
            },
          ]}
        />
        <Spotlight
          surface="alt"
          className={styles['shot-spotlight']}
          heading={translate({
            id: 'home.showcase.heading',
            message: 'Inside the web interface',
            description: 'Front page heading above the web interface screenshots',
          })}
        >
          <Showcase
            tabsLabel={translate({
              id: 'home.showcase.tabsLabel',
              message: 'Web interface pages',
              description: 'Accessible label for the screenshot tabs on the front page',
            })}
            items={[
              {
                label: translate({
                  id: 'home.showcase.torrents.label',
                  message: 'Torrents',
                  description: 'Front page screenshot tab for the Torrents page',
                }),
                heading: translate({
                  id: 'home.showcase.torrents.heading',
                  message: 'Your whole library in one list',
                  description: 'Front page heading for the Torrents page screenshot',
                }),
                description: translate({
                  id: 'home.showcase.torrents.description',
                  message: 'Filter by status, profile, or label, run batch actions, and see each torrent\'s progress, speed, and the VPN connection it runs through.',
                  description: 'Front page description for the Torrents page screenshot',
                }),
                link: {
                  label: translate({
                    id: 'home.showcase.torrents.link',
                    message: 'Manage Torrents',
                    description: 'Front page link from the Torrents screenshot to its guide',
                  }),
                  to: '/docs/torrents/managing-torrents/',
                },
                content: (
                  <BrowserFrame title="Transmission VPN" url="localhost:22602" favicon="/favicon.svg">
                    <ThemedImage
                      sources={{
                        light: managingTorrentsOneLight,
                        dark: managingTorrentsOneDark,
                      }}
                      alt={translate({
                        id: 'home.showcase.torrents.alt',
                        message: 'Torrents page listing torrents with their status, profile, labels, progress, and speeds',
                        description: 'Alt text for the Torrents page screenshot on the front page',
                      })}
                      width={1280}
                      height={1330}
                    />
                  </BrowserFrame>
                ),
              },
              {
                label: translate({
                  id: 'home.showcase.vpn.label',
                  message: 'VPN',
                  description: 'Front page screenshot tab for the VPN page',
                }),
                heading: translate({
                  id: 'home.showcase.vpn.heading',
                  message: 'Several VPN connections at once',
                  description: 'Front page heading for the VPN page screenshot',
                }),
                description: translate({
                  id: 'home.showcase.vpn.description',
                  message: 'Each connection runs its own Transmission. See which ones are protected, the endpoint each one uses, and how many torrents each one carries.',
                  description: 'Front page description for the VPN page screenshot',
                }),
                link: {
                  label: translate({
                    id: 'home.showcase.vpn.link',
                    message: 'Set Up VPN Connections',
                    description: 'Front page link from the VPN screenshot to its guide',
                  }),
                  to: '/docs/vpn/connections/',
                },
                content: (
                  <BrowserFrame title="Transmission VPN" url="localhost:22602" favicon="/favicon.svg">
                    <ThemedImage
                      sources={{
                        light: connectionsOneLight,
                        dark: connectionsOneDark,
                      }}
                      alt={translate({
                        id: 'home.showcase.vpn.alt',
                        message: 'VPN page listing three connections with their status, current endpoint, and torrent count',
                        description: 'Alt text for the VPN page screenshot on the front page',
                      })}
                      width={1280}
                      height={900}
                    />
                  </BrowserFrame>
                ),
              },
              {
                label: translate({
                  id: 'home.showcase.remoteApps.label',
                  message: 'Remote apps',
                  description: 'Front page screenshot tab for the Remote apps page',
                }),
                heading: translate({
                  id: 'home.showcase.remoteApps.heading',
                  message: 'Bring your favorite Transmission app',
                  description: 'Front page heading for the Remote apps page screenshot',
                }),
                description: translate({
                  id: 'home.showcase.remoteApps.description',
                  message: 'Give Transmission clients their own RPC logins and scripts their own scoped API tokens, without sharing your web interface password.',
                  description: 'Front page description for the Remote apps page screenshot',
                }),
                link: {
                  label: translate({
                    id: 'home.showcase.remoteApps.link',
                    message: 'Connect Remote Apps',
                    description: 'Front page link from the Remote apps screenshot to its guide',
                  }),
                  to: '/docs/remote-access/remote-apps/',
                },
                content: (
                  <BrowserFrame title="Transmission VPN" url="localhost:22602" favicon="/favicon.svg">
                    <ThemedImage
                      sources={{
                        light: remoteAppsOneLight,
                        dark: remoteAppsOneDark,
                      }}
                      alt={translate({
                        id: 'home.showcase.remoteApps.alt',
                        message: 'Remote apps page with the RPC proxy, RPC logins, API tokens, and web proxy logins',
                        description: 'Alt text for the Remote apps page screenshot on the front page',
                      })}
                      width={1280}
                      height={952}
                    />
                  </BrowserFrame>
                ),
              },
            ]}
          />
        </Spotlight>
        <BlogPreview
          heading={translate({
            id: 'home.blogPreview.heading',
            message: 'From the Blog',
            description: 'Front page Blog Preview section heading',
          })}
          description={translate({
            id: 'home.blogPreview.description',
            message: 'Launches, milestones, and what\'s new in Transmission VPN.',
            description: 'Front page Blog Preview section description',
          })}
          auto={true}
          limit={3}
          sort="newest"
        />
      </main>
    </Layout>
  );
}

export default Home;
