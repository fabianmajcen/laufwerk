import { API_BASE, gcRequest } from "./http";
import { AuthExpiredError, ensureFreshToken, refreshTokens } from "./auth";
import { ep, type Endpoint } from "./endpoints";
import { getKv, setKv } from "../db/repo";

export class RateLimitedError extends Error {
  retryAfterS: number;
  constructor(retryAfterS: number) {
    super(`Garmin rate limit (retry after ${retryAfterS}s)`);
    this.name = "RateLimitedError";
    this.retryAfterS = retryAfterS;
  }
}

export class GcHttpError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`Garmin API ${status} on ${path}`);
    this.name = "GcHttpError";
    this.status = status;
  }
}

/** Authenticated GET against connectapi. 401 → refresh → retry once;
 *  429 → RateLimitedError (sync engine decides how to back off). */
export async function gcGet<T = unknown>(endpoint: Endpoint, retried = false): Promise<T> {
  const token = await ensureFreshToken();

  let res;
  try {
    res = await gcRequest({
      url: API_BASE + endpoint.path,
      params: endpoint.params,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    // one retry on transient network failure
    if (retried) throw e;
    await sleep(5000);
    return gcGet<T>(endpoint, true);
  }

  if (res.status === 401 || res.status === 403) {
    if (retried) throw new AuthExpiredError();
    await refreshTokens();
    return gcGet<T>(endpoint, true);
  }
  if (res.status === 429) {
    const ra = Number(res.headers["retry-after"]);
    throw new RateLimitedError(Number.isFinite(ra) && ra > 0 ? ra : 60);
  }
  if (res.status >= 400) throw new GcHttpError(res.status, endpoint.path);
  return res.data as T;
}

const DISPLAY_NAME_KEY = "displayName";

/** UUID-ish user id embedded in several endpoint paths. Cached forever. */
export async function getDisplayName(): Promise<string> {
  const cachedName = await getKv<string>(DISPLAY_NAME_KEY);
  if (cachedName) return cachedName;
  const profile = await gcGet<{ displayName?: string }>(ep.socialProfile());
  if (!profile?.displayName) throw new Error("socialProfile returned no displayName");
  await setKv(DISPLAY_NAME_KEY, profile.displayName);
  return profile.displayName;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
