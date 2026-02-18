import { useSegments } from "expo-router";

export type MainRoute = "settings" | "channel" | "index" | "unknown";

/**
 * Returns the current route within the (main) group.
 *
 * Checks specific segment positions rather than using `segments.includes()`
 * which could false-positive on unrelated route names.
 */
export function useCurrentRoute(): MainRoute {
  const segments: string[] = useSegments();

  // Segments for (main) group routes:
  //   /(main)/settings      → ["(main)", "settings"]
  //   /(main)/channels/[id] → ["(main)", "channels", "<id>"]
  //   /(main)               → ["(main)"]
  const mainSegment = segments[1];

  if (mainSegment === "settings") return "settings";
  if (mainSegment === "channels") return "channel";
  if (mainSegment === undefined) return "index";
  return "unknown";
}
