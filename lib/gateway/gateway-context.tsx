"use client";

import type { DispatchEvent } from "@uncord-chat/protocol/events/dispatch";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { useAuthActions, useAuthState, useCurrentServer } from "@/lib/auth/auth-context";
import { getAccessToken } from "@/lib/auth/token-store";
import { GatewayClient } from "@/lib/gateway/gateway-client";

type GatewayContextValue = GatewayClient | null;

const GatewayContext = createContext<GatewayContextValue>(null);

// Module-level singleton — guarantees at most one live gateway connection
// regardless of React Strict Mode double-fires or rapid re-mounts.
let activeClient: GatewayClient | null = null;

export function GatewayProvider({ children }: { children: ReactNode }) {
  const { currentServerId } = useAuthState();
  const currentServer = useCurrentServer();
  const { refreshSession } = useAuthActions();
  const [client, setClient] = useState<GatewayClient | null>(null);

  // Derive a stable primitive for the effect dependency — object references
  // from useMemo can change even when the data is identical, which would
  // needlessly re-fire the effect and create duplicate connections.
  const baseUrl = currentServer?.baseUrl ?? null;

  // Keep refs so the getToken callback always reads fresh values.
  const currentServerIdRef = useRef(currentServerId);
  currentServerIdRef.current = currentServerId;
  const refreshSessionRef = useRef(refreshSession);
  refreshSessionRef.current = refreshSession;

  useEffect(() => {
    if (!currentServerId || !baseUrl) {
      setClient(null);
      return;
    }

    const serverId = currentServerId;

    // Set when the gateway rejects our token (close 4004). Forces a session
    // refresh on the next getToken call so we don't keep sending stale tokens.
    // Expires after 30 seconds to prevent stale flags from persisting if no
    // reconnect occurs.
    let tokenRejectedAt = 0;
    const TOKEN_REJECTED_TTL_MS = 30_000;

    const getToken = async (): Promise<string | null> => {
      if (tokenRejectedAt > 0 && Date.now() - tokenRejectedAt < TOKEN_REJECTED_TTL_MS) {
        tokenRejectedAt = 0;
        await refreshSessionRef.current(serverId);
        return getAccessToken(serverId);
      }
      let token = await getAccessToken(serverId);
      if (token) return token;
      await refreshSessionRef.current(serverId);
      token = await getAccessToken(serverId);
      return token;
    };

    const gw = new GatewayClient(baseUrl, getToken);

    // Listen for close code 4004 (invalid token) to force a token refresh
    // before the next reconnect attempt.
    gw.on("close", (data) => {
      const { code } = data as { code: number };
      if (code === 4004) {
        tokenRejectedAt = Date.now();
      }
    });

    // Defer connect so React Strict Mode's immediate cleanup can cancel it
    // before the WebSocket handshake begins. Without this, the double-fire
    // creates two live connections and the server's displacement logic loops.
    const connectTimer = setTimeout(() => {
      // Tear down any lingering singleton before activating the new one.
      if (activeClient && activeClient !== gw) {
        activeClient.disconnect();
      }
      activeClient = gw;
      gw.connect();
      setClient(gw);
    }, 0);

    return () => {
      clearTimeout(connectTimer);
      if (activeClient === gw) {
        activeClient = null;
      }
      gw.disconnect();
    };
  }, [currentServerId, baseUrl]);

  return <GatewayContext.Provider value={client}>{children}</GatewayContext.Provider>;
}

/** Returns the current GatewayClient instance, or null if not connected. */
export function useGateway(): GatewayClient | null {
  return useContext(GatewayContext);
}

/**
 * Subscribe to a gateway dispatch event. The handler is called whenever the
 * event fires. Automatically cleans up on unmount or when dependencies change.
 */
export function useGatewayEvent(event: DispatchEvent | "open" | "close", handler: (data: unknown) => void): void {
  const client = useGateway();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableHandler = useCallback((data: unknown) => {
    try {
      handlerRef.current(data);
    } catch (err) {
      console.error(`Gateway event handler error:`, err);
    }
  }, []);

  useEffect(() => {
    if (!client) return;
    return client.on(event, stableHandler);
    // stableHandler has an empty dependency array so its reference never changes;
    // omitted from deps to avoid unnecessary re-subscriptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, event]);
}
