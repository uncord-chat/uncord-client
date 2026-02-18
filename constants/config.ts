/**
 * Runtime configuration from environment. EXPO_PUBLIC_* vars are exposed at build time.
 */

const raw = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";
const base = raw.replace(/\/+$/, "");

/** Base URL for the Uncord server (no trailing slash). e.g. http://localhost:8080 */
export const API_BASE_URL: string = base;

/** Default timeout for API requests and async operations (15 seconds). */
export const DEFAULT_TIMEOUT_MS = 15_000;
