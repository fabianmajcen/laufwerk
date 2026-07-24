import { defineConfig, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Native Garmin Connect app headers, mirrored from the installed python
// garminconnect client (client.py _native_headers). The dev proxy injects them
// because a browser cannot set User-Agent; on-device the app sets them itself
// via CapacitorHttp (src/lib/garmin/http.ts — keep both copies in sync).
const GARMIN_HEADERS: Record<string, string> = {
  "User-Agent": "GCM-Android-5.23",
  "X-Garmin-User-Agent":
    "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "X-Garmin-Paired-App-Version": "10861",
  "X-Garmin-Client-Platform": "Android",
  "X-App-Ver": "10861",
  "X-Lang": "en",
  "X-GCExperience": "GC5",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Dev-only: serves the PC's Garmin token cache so the browser app can
 *  auto-bootstrap without a paste step. Never part of a build. */
function devTokens(): Plugin {
  return {
    name: "laufwerk-dev-tokens",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/dev-tokens", (_req, res) => {
        try {
          const raw = readFileSync(join(homedir(), ".garmin_tokens", "garmin_tokens.json"), "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.end(raw);
        } catch (e) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

function proxyWithHeaders(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/gc-(api|auth)/, ""),
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        for (const [k, v] of Object.entries(GARMIN_HEADERS)) proxyReq.setHeader(k, v);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devTokens()],
  server: {
    proxy: {
      "/gc-api": proxyWithHeaders("https://connectapi.garmin.com"),
      "/gc-auth": proxyWithHeaders("https://diauth.garmin.com"),
    },
  },
});
