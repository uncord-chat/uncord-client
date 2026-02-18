/**
 * Persistent storage for access and refresh tokens per server.
 *
 * Native: SecureStore (encrypted keychain/keystore) — tokens are stored in the
 *         platform's secure enclave (iOS Keychain / Android Keystore).
 *
 * Web:    localStorage — tokens are stored in plaintext browser storage. This is
 *         an accepted trade-off: any XSS vulnerability in the web build would
 *         grant access to stored tokens. sessionStorage offers no additional XSS
 *         protection (JavaScript can read both) while preventing session persistence
 *         across browser restarts. A more secure alternative would be httpOnly
 *         cookies (requires backend support) or a service-worker-mediated store.
 *         This risk is documented in the project's SECURITY.md and is mitigated by
 *         CSP headers and XSS prevention at the rendering layer.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY_PREFIX = "uncord_tokens_";

function accessKey(serverId: string): string {
  return `${KEY_PREFIX}${serverId}_access`;
}
function refreshKey(serverId: string): string {
  return `${KEY_PREFIX}${serverId}_refresh`;
}

const isWeb = Platform.OS === "web";

// ---------------------------------------------------------------------------
// Web helpers — use localStorage for persistence across browser sessions.
// ---------------------------------------------------------------------------

function webGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function webSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch (e) {
    console.warn("Failed to store token in localStorage (private browsing or quota exceeded):", e);
  }
}

function webRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Ignore.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAccessToken(serverId: string): Promise<string | null> {
  if (isWeb) return webGet(accessKey(serverId));
  return SecureStore.getItemAsync(accessKey(serverId));
}

export async function getRefreshToken(serverId: string): Promise<string | null> {
  if (isWeb) return webGet(refreshKey(serverId));
  return SecureStore.getItemAsync(refreshKey(serverId));
}

export async function setTokens(serverId: string, accessToken: string, refreshToken: string): Promise<void> {
  if (isWeb) {
    webSet(accessKey(serverId), accessToken);
    webSet(refreshKey(serverId), refreshToken);
  } else {
    await SecureStore.setItemAsync(accessKey(serverId), accessToken);
    await SecureStore.setItemAsync(refreshKey(serverId), refreshToken);
  }
}

export async function clearTokens(serverId: string): Promise<void> {
  if (isWeb) {
    webRemove(accessKey(serverId));
    webRemove(refreshKey(serverId));
  } else {
    await SecureStore.deleteItemAsync(accessKey(serverId));
    await SecureStore.deleteItemAsync(refreshKey(serverId));
  }
}
