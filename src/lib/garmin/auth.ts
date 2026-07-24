import { Preferences } from "@capacitor/preferences";
import { AUTH_BASE, gcRequest } from "./http";
import type { DiTokens } from "./types";

const TOKENS_KEY = "garmin_di_tokens";
const REFRESH_MARGIN_S = 900; // refresh when JWT exp is within 15 min (python parity)

export class AuthExpiredError extends Error {
  constructor(msg = "Garmin authentication expired — re-paste tokens from the PC") {
    super(msg);
    this.name = "AuthExpiredError";
  }
}

let cached: DiTokens | null = null;
let inflightRefresh: Promise<DiTokens> | null = null;

export async function getTokens(): Promise<DiTokens | null> {
  if (cached) return cached;
  const { value } = await Preferences.get({ key: TOKENS_KEY });
  if (!value) return null;
  try {
    cached = JSON.parse(value) as DiTokens;
  } catch {
    cached = null;
  }
  return cached;
}

async function persistTokens(tokens: DiTokens): Promise<void> {
  cached = tokens;
  await Preferences.set({ key: TOKENS_KEY, value: JSON.stringify(tokens) });
}

export async function clearTokens(): Promise<void> {
  cached = null;
  await Preferences.remove({ key: TOKENS_KEY });
}

/** base64url JWT payload decode — no dependency needed. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

function expiresSoon(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  if (exp == null) return true; // unreadable → treat as stale
  return Date.now() / 1000 > exp - REFRESH_MARGIN_S;
}

/** Refresh the DI bearer token. Single-flight: concurrent callers share one
 *  request. Both tokens are persisted before the promise resolves, so a kill
 *  mid-sync can never lose a rotated refresh token. */
export function refreshTokens(): Promise<DiTokens> {
  if (!inflightRefresh) {
    inflightRefresh = doRefresh().finally(() => {
      inflightRefresh = null;
    });
  }
  return inflightRefresh;
}

async function doRefresh(): Promise<DiTokens> {
  const tokens = await getTokens();
  if (!tokens?.di_refresh_token || !tokens.di_client_id) throw new AuthExpiredError("No refresh token stored");

  const res = await gcRequest({
    url: `${AUTH_BASE}/di-oauth2-service/oauth/token`,
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${tokens.di_client_id}:`) },
    form: {
      grant_type: "refresh_token",
      client_id: tokens.di_client_id,
      refresh_token: tokens.di_refresh_token,
    },
  });

  if (res.status >= 400 && res.status < 500) {
    throw new AuthExpiredError(`DI token refresh rejected (${res.status})`);
  }
  if (res.status !== 200) {
    throw new Error(`DI token refresh failed: HTTP ${res.status}`);
  }

  const data = res.data as { access_token?: string; refresh_token?: string };
  if (!data?.access_token) throw new Error("DI token refresh: no access_token in response");

  const payload = decodeJwtPayload(data.access_token);
  const next: DiTokens = {
    di_token: data.access_token,
    // rotation: keep the old refresh token when the response omits one (python parity)
    di_refresh_token: data.refresh_token ?? tokens.di_refresh_token,
    di_client_id: (payload?.client_id as string) ?? tokens.di_client_id,
  };
  await persistTokens(next);
  return next;
}

/** Valid bearer token, refreshing first if it is (nearly) expired. */
export async function ensureFreshToken(): Promise<string> {
  const tokens = await getTokens();
  if (!tokens) throw new AuthExpiredError("Not connected to Garmin");
  if (expiresSoon(tokens.di_token)) {
    const fresh = await refreshTokens();
    return fresh.di_token;
  }
  return tokens.di_token;
}

/** First-time setup: store pasted tokens and validate them by refreshing
 *  immediately (the pasted di_token is typically already expired). */
export async function bootstrapFromJson(json: string): Promise<DiTokens> {
  let parsed: Partial<DiTokens>;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That is not valid JSON — paste the full contents of garmin_tokens.json");
  }
  if (!parsed.di_token || !parsed.di_refresh_token || !parsed.di_client_id) {
    throw new Error("JSON must contain di_token, di_refresh_token and di_client_id");
  }
  await persistTokens(parsed as DiTokens);
  return refreshTokens(); // proves the refresh token works; persists the rotated pair
}

export async function isConnected(): Promise<boolean> {
  return (await getTokens()) != null;
}
