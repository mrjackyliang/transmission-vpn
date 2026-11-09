import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

import { registerPackageScriptsSuite } from '@cbnventures/nova/rules/vitest';
import * as vitest from 'vitest';
import {
  describe,
  expect,
  it,
} from 'vitest';

import packageJson from '../package.json' with { type: 'json' };

/**
 * Project - Read Transmission Release.
 *
 * Runs the image's release picker on the fixture release list for one series.
 * Returns the shell assignments that the Transmission build stage reads.
 *
 * @param {Project_Test_String} series - Series.
 *
 * @returns {Project_Test_String}
 *
 * @since 0.0.0
 */
const readTransmissionRelease = (series: Project_Test_String): Project_Test_String => execFileSync('jq', [
  '--exit-status',
  '--raw-output',
  '--arg',
  'series',
  series,
  '--from-file',
  fileURLToPath(new URL('../packages/docker/transmission-release.jq', import.meta.url)),
  fileURLToPath(new URL('./fixtures/transmission-releases.json', import.meta.url)),
], {
  encoding: 'utf8',
  stdio: 'pipe',
});

/**
 * Project - Project Root.
 *
 * Confirms the repository root remains a private monorepo coordinator.
 *
 * @since 0.0.0
 */
describe('Project root', () => {
  it('stays private', () => {
    expect(packageJson['private']).toBe(true);

    return;
  });

  it('keeps one repository-wide container assembly', () => {
    expect(existsSync(new URL('../Dockerfile', import.meta.url))).toBe(true);

    expect(existsSync(new URL('../compose.yml', import.meta.url))).toBe(true);

    expect(existsSync(new URL('../.dockerignore', import.meta.url))).toBe(true);

    expect(existsSync(new URL('../packages/docker/package.json', import.meta.url))).toBe(true);

    expect(existsSync(new URL('../packages/docker/manifest.json', import.meta.url))).toBe(true);

    expect(existsSync(new URL('../packages/docker/build-package.json', import.meta.url))).toBe(true);

    expect(existsSync(new URL('../apps/transmission/Dockerfile', import.meta.url))).toBe(false);

    expect(existsSync(new URL('../apps/transmission/compose.yml', import.meta.url))).toBe(false);

    expect(existsSync(new URL('../apps/transmission/.dockerignore', import.meta.url))).toBe(false);

    expect(existsSync(new URL('../apps/transmission/rootfs', import.meta.url))).toBe(false);

    expect(existsSync(new URL('../apps/transmission/web/package.json', import.meta.url))).toBe(false);

    return;
  });

  it('uses a selective root-context build and native s6-rc user bundle', () => {
    const dockerfile: Project_Test_String = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
    const dockerignore: Project_Test_String = readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8');
    const userBundleRoot: Project_Test_String = '../packages/docker/rootfs/etc/s6-overlay/user-bundles.d/user/contents.d/';

    expect(dockerfile).toContain('COPY packages/docker/build-package.json ./package.json');

    expect(dockerfile).toContain('COPY ["apps/transmission/package.json", "apps/transmission/package.json"]');

    expect(dockerfile).toContain('npm run build:web --workspace=\'transmission-vpn-app-transmission\'');

    expect(dockerfile).toContain('COPY packages/docker/rootfs/ /');

    expect(dockerfile).not.toContain('COPY . .');

    expect(dockerignore).toContain('**/.env');

    expect(dockerignore).toContain('**/.env.*');

    expect(dockerignore).toContain('!**/.env.sample');

    expect(dockerignore).toContain('!**/.env.example');

    expect(dockerignore).toContain('**/build');

    expect(dockerignore).toContain('**/dist');

    expect(dockerignore).toContain('**/node_modules');

    expect(existsSync(new URL(`${userBundleRoot}config-init`, import.meta.url))).toBe(true);

    expect(existsSync(new URL(`${userBundleRoot}control-api`, import.meta.url))).toBe(true);

    expect(existsSync(new URL(`${userBundleRoot}directory-controller`, import.meta.url))).toBe(true);

    expect(existsSync(new URL(`${userBundleRoot}firewall-init`, import.meta.url))).toBe(true);

    expect(existsSync(new URL(`${userBundleRoot}transmission`, import.meta.url))).toBe(true);

    expect(existsSync(new URL(`${userBundleRoot}vpn-controller`, import.meta.url))).toBe(true);

    expect(existsSync(new URL(`${userBundleRoot}web-proxy`, import.meta.url))).toBe(true);

    expect(existsSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/user',
      import.meta.url,
    ))).toBe(false);

    return;
  });

  it('builds the newest release of a Transmission series that trackers accept', () => {
    const dockerfile: Project_Test_String = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
    const seriesPrefix: Project_Test_String = 'ARG TRANSMISSION_SERIES="';
    const seriesLine: Project_Test_String = dockerfile.split('\n').find((line: Project_Test_String): Project_Test_Boolean => line.startsWith(seriesPrefix)) ?? '';
    const series: Project_Test_String = seriesLine.slice(seriesPrefix.length, -1);

    expect(series.split('.')).toHaveLength(2);

    expect(series.split('.').every((part: Project_Test_String): Project_Test_Boolean => part !== '' && String(Number(part)) === part)).toBe(true);

    // Trackers ban Transmission 4.0.6 for its bugs and ask for 4.1.0 or newer.
    expect(series.localeCompare('4.1', 'en', { numeric: true })).toBeGreaterThanOrEqual(0);

    expect(dockerfile).not.toContain('ARG TRANSMISSION_VERSION');

    expect(dockerfile).toContain('ADD https://github.com/transmission/transmission/releases.atom ./releases.atom');

    expect(dockerfile).toContain('--from-file transmission-release.jq releases.json > transmission.env');

    expect(dockerfile).toContain('COPY --from=transmission-release /release/transmission.env ./transmission.env');

    expect(dockerfile).toContain('RUN . ./transmission.env');

    expect(dockerfile).toContain('| sha256sum -c -');

    expect(dockerfile).toContain('/build/install/usr/local/bin/transmission-daemon --version 2>&1');

    return;
  });

  it('picks the newest stable patch of a series with a checksummed source archive', () => {
    expect(readTransmissionRelease('4.1')).toBe([
      'TRANSMISSION_VERSION=4.1.10',
      `TRANSMISSION_SHA256=${'a'.repeat(64)}`,
      '',
    ].join('\n'));

    expect(() => readTransmissionRelease('4.0')).toThrow('Trackers ban 4.0.6 for its bugs');

    expect(() => readTransmissionRelease('4.2')).toThrow('Transmission 4.2.0 has no SHA-256 digest');

    expect(() => readTransmissionRelease('4.3')).toThrow('No Transmission 4.3 release was found');

    expect(() => readTransmissionRelease('4.1.10')).toThrow('must look like 4.1, not 4.1.10');

    return;
  });

  it('records the appliance dependency and privilege policies', () => {
    const manifest: Project_Test_String = readFileSync(
      new URL('../packages/docker/manifest.json', import.meta.url),
      'utf8',
    );
    const controlRun: Project_Test_String = readFileSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/control-api/run',
      import.meta.url,
    ), 'utf8');
    const directoryRun: Project_Test_String = readFileSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/directory-controller/run',
      import.meta.url,
    ), 'utf8');
    const transmissionRun: Project_Test_String = readFileSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/transmission/run',
      import.meta.url,
    ), 'utf8');
    const vpnRun: Project_Test_String = readFileSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/vpn-controller/run',
      import.meta.url,
    ), 'utf8');
    const webProxyRun: Project_Test_String = readFileSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/web-proxy/run',
      import.meta.url,
    ), 'utf8');

    expect(manifest).not.toContain('"critical": true');

    expect(existsSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/firewall-init/dependencies.d/config-init',
      import.meta.url,
    ))).toBe(true);

    expect(existsSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/control-api/dependencies.d/directory-controller',
      import.meta.url,
    ))).toBe(true);

    expect(existsSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/transmission/dependencies.d/firewall-init',
      import.meta.url,
    ))).toBe(true);

    expect(existsSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/vpn-controller/dependencies.d/firewall-init',
      import.meta.url,
    ))).toBe(true);

    expect(existsSync(new URL(
      '../packages/docker/rootfs/etc/s6-overlay/s6-rc.d/web-proxy/dependencies.d/firewall-init',
      import.meta.url,
    ))).toBe(true);

    expect(controlRun).toContain('/command/s6-setuidgid control');

    expect(directoryRun).toContain('/command/s6-setuidgid transmission');

    expect(transmissionRun).toContain('/command/s6-setuidgid transmission');

    expect(vpnRun).not.toContain('s6-setuidgid');

    expect(webProxyRun).toContain('/command/s6-setuidgid webproxy');

    return;
  });

  it('publishes one OCI artifact to both configured registries', () => {
    const workflow: Project_Test_String = readFileSync(new URL(
      '../.github/workflows/nova-publish-project.yml',
      import.meta.url,
    ), 'utf8');
    const novaConfig: Project_Test_String = readFileSync(
      new URL('../nova.config.json', import.meta.url),
      'utf8',
    );

    expect(workflow.split('uses: "docker/build-push-action@v7"')).toHaveLength(2);

    expect(workflow).toContain('context: "./"');

    expect(workflow).toContain('name: "container-oci"');

    expect(workflow).toContain('publish-docker-hub-root:');

    expect(workflow).toContain('publish-ghcr-root:');

    expect(workflow).toContain('oras cp --from-oci-layout');

    expect(workflow).not.toContain('context: "./apps/transmission"');

    expect(novaConfig).toContain('"IMAGE_NAMESPACE": "mrjackyliang"');

    expect(novaConfig).toContain('"IMAGE_REPOSITORY": "transmission-vpn"');

    expect(novaConfig).toContain('"path": "./apps/docs"');

    return;
  });

  return;
});

registerPackageScriptsSuite({
  vitest,
  requireRootScripts: true,
  enable: 'all',
});
