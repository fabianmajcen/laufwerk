import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "at.fmajcen.laufwerk",
  appName: "Laufwerk",
  webDir: "dist",
  // no CapacitorHttp fetch-patching: the app calls CapacitorHttp.request()
  // explicitly (src/lib/garmin/http.ts) for full header control
};

export default config;
