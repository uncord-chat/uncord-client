import { getAccessToken } from "@/lib/auth/token-store";

type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export type FetchResult<T> = { ok: true; data: T } | { ok: false; reason: string; code?: string };

/** Overall timeout for the full fetch-with-refresh cycle (fetch + refresh + retry). */
const OVERALL_TIMEOUT_MS = 30_000;

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Request timed out."));
    }, ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Wraps an authenticated API call with automatic TOKEN_EXPIRED retry.
 *
 * 1. Gets the stored access token.
 * 2. Calls `fetcher(baseUrl, token)`.
 * 3. If the server returns TOKEN_EXPIRED, refreshes the session and retries once.
 *
 * The entire cycle is subject to a 30-second overall timeout.
 */
export async function fetchWithRefresh<T>(
  serverId: string,
  baseUrl: string,
  fetcher: (baseUrl: string, token: string) => Promise<ApiResult<T>>,
  refreshSession: (serverId: string) => Promise<void>,
): Promise<FetchResult<T>> {
  try {
    return await withTimeout(doFetchWithRefresh(serverId, baseUrl, fetcher, refreshSession), OVERALL_TIMEOUT_MS);
  } catch {
    return { ok: false, reason: "Request timed out." };
  }
}

async function doFetchWithRefresh<T>(
  serverId: string,
  baseUrl: string,
  fetcher: (baseUrl: string, token: string) => Promise<ApiResult<T>>,
  refreshSession: (serverId: string) => Promise<void>,
): Promise<FetchResult<T>> {
  const token = await getAccessToken(serverId);
  if (!token) return { ok: false, reason: "Not authenticated." };
  const result = await fetcher(baseUrl, token);
  if (result.ok) return { ok: true, data: result.data };
  if (result.code === "TOKEN_EXPIRED") {
    await refreshSession(serverId);
    const newToken = await getAccessToken(serverId);
    if (!newToken) return { ok: false, reason: "Session expired. Please log in again." };
    const retry = await fetcher(baseUrl, newToken);
    if (retry.ok) return { ok: true, data: retry.data };
    return { ok: false, reason: retry.message, code: retry.code };
  }
  return { ok: false, reason: result.message, code: result.code };
}

/**
 * Gets a valid access token, refreshing the session if the stored token is missing.
 *
 * Use this for fire-and-forget calls (e.g. typing indicators) where a full
 * fetchWithRefresh wrapper isn't needed.
 */
export async function getValidToken(
  serverId: string,
  refreshSession: (serverId: string) => Promise<void>,
): Promise<string | null> {
  let token = await getAccessToken(serverId);
  if (token) return token;
  await refreshSession(serverId);
  token = await getAccessToken(serverId);
  return token;
}
