import { useAuthState } from "@/lib/auth/auth-context";

export type AuthGateStatus = "loading" | "unauthenticated" | "authenticated";

/**
 * Determines the current authentication gate status for the main layout.
 * Consolidates auth checks into a single hook to prevent diverging logic.
 */
export function useAuthGate(): { status: AuthGateStatus; currentServerId: string | null } {
  const { tokensLoaded, servers, currentServerId, users } = useAuthState();

  if (!tokensLoaded || servers.length === 0 || !currentServerId) {
    return { status: "loading", currentServerId };
  }

  const currentUser = currentServerId ? users[currentServerId] : null;

  if (currentUser) {
    return { status: "authenticated", currentServerId };
  }

  return { status: "unauthenticated", currentServerId };
}

/**
 * Checks whether the user needs to be redirected to the server setup screen.
 * Used by both the gate screen and the main layout to avoid duplicated logic.
 */
export function useNeedsServerSetup(): boolean {
  const { tokensLoaded, servers, currentServerId } = useAuthState();
  return tokensLoaded && (servers.length === 0 || !currentServerId);
}
