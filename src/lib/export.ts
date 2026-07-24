// Full local-cache export: share a JSON file on device, download in browser.
import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { exportAll } from "./db/repo";

export async function exportBackup(): Promise<void> {
  const data = await exportAll();
  const json = JSON.stringify(data);
  const name = `laufwerk-backup-${data.exportedAt.slice(0, 10)}.json`;

  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: name,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: name, url: file.uri, dialogTitle: "Export Laufwerk backup" });
    return;
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
