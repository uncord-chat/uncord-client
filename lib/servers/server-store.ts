/**
 * Persistent list of added Uncord servers. Uses AsyncStorage so it works on all platforms.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "uncord_servers";

export type Server = {
  id: string;
  baseUrl: string;
  name?: string;
};

function normaliseBaseUrl(input: string): string {
  const trimmed = input.trim();
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  try {
    const u = new URL(withoutTrailing || "http://localhost");
    return `${u.origin}${u.pathname === "/" ? "" : u.pathname}`.replace(/\/+$/, "");
  } catch {
    return withoutTrailing || "http://localhost:8080";
  }
}

/** Generate a stable id from base URL so the same URL always yields the same id. */
export function serverIdFromBaseUrl(baseUrl: string): string {
  const normalised = normaliseBaseUrl(baseUrl);
  try {
    const u = new URL(normalised);
    return `${u.protocol}//${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return normalised;
  }
}

export async function getServers(): Promise<Server[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is Server =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Server).id === "string" &&
        typeof (s as Server).baseUrl === "string",
    );
  } catch (e) {
    console.warn("Failed to parse stored server list:", e);
    return [];
  }
}

export async function addServer(baseUrl: string, name?: string): Promise<Server> {
  const normalised = normaliseBaseUrl(baseUrl);
  const id = serverIdFromBaseUrl(normalised);
  const servers = await getServers();
  const existing = servers.find((s) => s.id === id);
  if (existing) {
    if (name && existing.name !== name) {
      const updated = { ...existing, name };
      const updatedList = servers.map((s) => (s.id === id ? updated : s));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      return updated;
    }
    return existing;
  }
  const server: Server = { id, baseUrl: normalised, ...(name ? { name } : {}) };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...servers, server]));
  return server;
}

export async function updateServerName(id: string, name: string): Promise<void> {
  const servers = await getServers();
  if (!servers.some((s) => s.id === id)) return;
  const updated = servers.map((s) => (s.id === id ? { ...s, name } : s));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function removeServer(id: string): Promise<void> {
  const servers = await getServers();
  const next = servers.filter((s) => s.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
