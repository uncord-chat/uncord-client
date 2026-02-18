"use client";

import type { PresenceState } from "@uncord-chat/protocol/models/gateway";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { useGatewayEvent } from "@/lib/gateway/gateway-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PresenceStateCtx = {
  presences: Map<string, string>;
};

type PresenceActionsCtx = {
  updatePresence: (userId: string, status: string) => void;
  getPresence: (userId: string) => string;
};

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isPresenceUpdateData(d: unknown): d is { user_id: string; status: string } {
  return (
    typeof d === "object" &&
    d !== null &&
    "user_id" in d &&
    "status" in d &&
    typeof (d as { user_id: unknown }).user_id === "string" &&
    typeof (d as { status: unknown }).status === "string"
  );
}

function isReadyDataWithPresences(d: unknown): d is { presences: PresenceState[] } {
  return (
    typeof d === "object" && d !== null && "presences" in d && Array.isArray((d as { presences: unknown }).presences)
  );
}

/** Maximum number of presence entries before evicting offline users. */
const MAX_PRESENCE_ENTRIES = 5_000;

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const PresenceStateContext = createContext<PresenceStateCtx | null>(null);
const PresenceActionsContext = createContext<PresenceActionsCtx | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [presences, setPresences] = useState<Map<string, string>>(new Map());

  // Ref so callbacks always read the latest map without re-subscribing.
  const presencesRef = useRef(presences);
  presencesRef.current = presences;

  // Seed from READY payload.
  useGatewayEvent("open", (data) => {
    if (!isReadyDataWithPresences(data)) return;
    const next = new Map<string, string>();
    for (const p of data.presences) {
      next.set(p.user_id, p.status);
    }
    setPresences(next);
  });

  // Live updates — includes inline eviction to avoid a double-render from a
  // separate effect that would fire after the map exceeds the limit.
  useGatewayEvent("PRESENCE_UPDATE", (data) => {
    if (!isPresenceUpdateData(data)) return;
    setPresences((prev) => {
      const next = new Map(prev);
      next.set(data.user_id, data.status);
      // Evict offline entries when the map grows too large.
      if (next.size > MAX_PRESENCE_ENTRIES) {
        for (const [id, status] of next) {
          if (status === "offline") next.delete(id);
        }
      }
      return next;
    });
  });

  const updatePresence = useCallback((userId: string, status: string) => {
    setPresences((prev) => {
      const next = new Map(prev);
      next.set(userId, status);
      return next;
    });
  }, []);

  const getPresence = useCallback((userId: string): string => {
    return presencesRef.current.get(userId) ?? "offline";
  }, []);

  const state = useMemo<PresenceStateCtx>(() => ({ presences }), [presences]);
  const actions = useMemo<PresenceActionsCtx>(() => ({ updatePresence, getPresence }), [updatePresence, getPresence]);

  return (
    <PresenceStateContext.Provider value={state}>
      <PresenceActionsContext.Provider value={actions}>{children}</PresenceActionsContext.Provider>
    </PresenceStateContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePresenceState(): PresenceStateCtx {
  const ctx = useContext(PresenceStateContext);
  if (!ctx) throw new Error("usePresenceState must be used within PresenceProvider");
  return ctx;
}

export function usePresenceActions(): PresenceActionsCtx {
  const ctx = useContext(PresenceActionsContext);
  if (!ctx) throw new Error("usePresenceActions must be used within PresenceProvider");
  return ctx;
}
