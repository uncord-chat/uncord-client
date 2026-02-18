import type { Href } from "expo-router";

/** Type-safe route constants for navigation. Eliminates `as Href` casts. */
export const Routes = {
  gate: "/" as Href,
  servers: "/(servers)" as Href,
  addServer: "/(servers)/add-server" as Href,
  main: "/(main)" as Href,
  settings: "/(main)/settings" as Href,
  channel: (channelId: string) => `/(main)/channels/${channelId}` as Href,
} as const;
