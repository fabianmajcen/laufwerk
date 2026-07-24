import { Capacitor, CapacitorHttp } from "@capacitor/core";

// Native Garmin Connect app headers, mirrored from the installed python
// garminconnect client (client.py _native_headers). On-device we send them
// directly via CapacitorHttp; in browser dev the Vite proxy injects them
// (a browser cannot set User-Agent) — keep vite.config.ts in sync.
export const GARMIN_HEADERS: Record<string, string> = {
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

const native = Capacitor.isNativePlatform();

export const API_BASE = native ? "https://connectapi.garmin.com" : "/gc-api";
export const AUTH_BASE = native ? "https://diauth.garmin.com" : "/gc-auth";

export interface GcResponse {
  status: number;
  data: unknown;
  headers: Record<string, string>;
}

export interface GcRequest {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  params?: Record<string, string>;
  /** application/x-www-form-urlencoded body (token refresh) */
  form?: Record<string, string>;
}

/** Platform HTTP adapter. Explicit CapacitorHttp on native (bypasses CORS,
 *  full header control); fetch against the dev proxy on web. */
export async function gcRequest(req: GcRequest): Promise<GcResponse> {
  const method = req.method ?? "GET";

  if (native) {
    const res = await CapacitorHttp.request({
      url: req.url,
      method,
      headers: {
        ...GARMIN_HEADERS,
        Accept: "application/json",
        ...(req.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...req.headers,
      },
      params: req.params,
      data: req.form ? new URLSearchParams(req.form).toString() : undefined,
    });
    return {
      status: res.status,
      data: res.data,
      headers: normalizeHeaders(res.headers ?? {}),
    };
  }

  const qs = req.params ? `?${new URLSearchParams(req.params)}` : "";
  const res = await fetch(req.url + qs, {
    method,
    headers: {
      Accept: "application/json",
      ...(req.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...req.headers,
    },
    body: req.form ? new URLSearchParams(req.form).toString() : undefined,
  });

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  return { status: res.status, data, headers };
}

function normalizeHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = v;
  return out;
}
