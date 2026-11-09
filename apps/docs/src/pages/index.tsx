import {
  BlogPreview,
  Canvas,
  Features,
  InstallStrip,
  Stats,
} from '@cbnventures/docusaurus-preset-nova/blocks';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import { useEffect, useState } from 'react';

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
 * Landing page that composes the hero with a VPN status panel, the install strip,
 * the feature grid, stats, and the blog preview using theme blocks.
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
                to="/docs/overview/"
              >
                {translate({
                  id: 'home.hero.ctaLabel',
                  message: 'Get Started',
                  description: 'Front page hero primary call-to-action button label',
                })}
              </Link>
              <Link
                className="nova-cta-secondary"
                to="https://github.com/mrjackyliang/transmission-vpn"
              >
                {translate({
                  id: 'home.hero.secondaryCtaLabel',
                  message: 'View on GitHub',
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
      <InstallStrip command="docker compose up --build --detach" />
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
        <Stats
          heading={translate({
            id: 'home.stats.heading',
            message: 'By the Numbers',
            description: 'Front page Stats section heading',
          })}
          items={[
            {
              value: '128',
              label: translate({
                id: 'home.stats.poolEndpoints.label',
                message: 'Endpoints in a pool',
                description: 'Front page Stats label for the endpoint pool size',
              }),
              color: 'primary',
            },
            {
              value: '5',
              label: translate({
                id: 'home.stats.tunnelChecks.label',
                message: 'Checks before Transmission connects',
                description: 'Front page Stats label for tunnel verification checks count',
              }),
              color: 'accent',
            },
            {
              value: '3',
              label: translate({
                id: 'home.stats.providerLists.label',
                message: 'Provider server lists built in',
                description: 'Front page Stats label for built-in provider server lists count',
              }),
              color: 'primary',
            },
            {
              value: '2',
              label: translate({
                id: 'home.stats.architectures.label',
                message: 'Architectures, amd64 and arm64',
                description: 'Front page Stats label for supported architectures count',
              }),
              color: 'accent',
            },
          ]}
        />
        <BlogPreview
          heading={translate({
            id: 'home.blogPreview.heading',
            message: 'From the Blog',
            description: 'Front page Blog Preview section heading',
          })}
          description={translate({
            id: 'home.blogPreview.description',
            message: 'Project updates, setup guides, and notes on VPN protection.',
            description: 'Front page Blog Preview section description',
          })}
          auto={true}
          limit={3}
        />
      </main>
    </Layout>
  );
}

export default Home;
