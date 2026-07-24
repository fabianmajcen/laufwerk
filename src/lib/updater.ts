// In-app updates: compare against the latest GitHub release, download the
// APK natively, and hand it to Android's installer. First install is manual;
// everything after is one tap in Settings.
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";

// owner/repo of the public Laufwerk repository (releases carry the APK)
export const UPDATE_REPO = "REPLACE_WITH_GITHUB_USER/laufwerk";

export const APP_VERSION = __APP_VERSION__;

export interface UpdateInfo {
  version: string;
  apkUrl: string;
  notes: string;
}

export function isUpdaterConfigured(): boolean {
  return !UPDATE_REPO.startsWith("REPLACE_");
}

/** Returns update info when a newer release exists, null when current. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) throw new Error("No releases published yet");
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const rel = (await res.json()) as {
    tag_name?: string;
    body?: string;
    assets?: { name: string; browser_download_url: string }[];
  };
  const version = (rel.tag_name ?? "").replace(/^v/, "");
  const apk = rel.assets?.find((a) => a.name.endsWith(".apk"));
  if (!version || !apk) throw new Error("Release has no APK attached");
  return isNewer(version, APP_VERSION) ? { version, apkUrl: apk.browser_download_url, notes: rel.body ?? "" } : null;
}

/** Download the APK and open Android's package installer. Native only. */
export async function downloadAndInstall(info: UpdateInfo, onProgress?: (pct: number | null) => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error("Updates install on the phone app");
  onProgress?.(null);

  const path = `laufwerk-${info.version}.apk`;
  const dl = await Filesystem.downloadFile({
    url: info.apkUrl,
    path,
    directory: Directory.Cache,
  });
  if (!dl.path) throw new Error("Download failed");

  await FileOpener.open({
    filePath: dl.path,
    contentType: "application/vnd.android.package-archive",
  });
}

/** semver-ish compare: is a newer than b? */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da > db;
  }
  return false;
}
