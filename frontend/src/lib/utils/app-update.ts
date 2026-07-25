import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { modalManager } from '@immich/ui';
import AppUpdateModal from '$lib/modals/AppUpdateModal.svelte';

const GITHUB_REPO = 'sivadhanushreddykotturu/photos-with-drive';
const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

type GitHubRelease = {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  assets: { name: string; browser_download_url: string }[];
};

const normalizeVersion = (version: string) => version.replace(/^v/, '').split('-')[0];

const isNewer = (latest: string, current: string) => {
  const a = normalizeVersion(latest).split('.').map(Number);
  const b = normalizeVersion(current).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
};

/**
 * Checks GitHub for a newer release and offers it in-app (Android OTA).
 * Runs once per app start, silent on any failure (offline, rate limit).
 */
export async function checkForAppUpdate() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    const [info, response] = await Promise.all([
      App.getInfo(),
      fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } }),
    ]);
    if (!response.ok) {
      return;
    }

    const release = (await response.json()) as GitHubRelease;
    if (!isNewer(release.tag_name, info.version)) {
      return;
    }

    const apkAsset = release.assets.find((asset) => asset.name.endsWith('.apk'));
    await modalManager
      .show(AppUpdateModal, {
        version: release.tag_name,
        notes: release.body,
        downloadUrl: apkAsset?.browser_download_url ?? release.html_url,
      })
      .catch(() => undefined);
  } catch {
    // Offline or GitHub unreachable — stay silent, try next launch.
  }
}
