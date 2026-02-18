import type { ApiError } from "@/lib/api/client";
import { login as apiLogin, refresh as apiRefresh, register as apiRegister, getMe, mfaVerify } from "@/lib/api/client";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/token-store";
import type { Server } from "@/lib/servers/server-store";
import {
  addServer as addServerToStore,
  getServers,
  removeServer as removeServerFromStore,
  serverIdFromBaseUrl,
  updateServerName,
} from "@/lib/servers/server-store";
import type { LoginRequest, RegisterRequest } from "@uncord-chat/protocol/models/auth";
import type { User } from "@uncord-chat/protocol/models/user";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type AuthState = {
  servers: Server[];
  currentServerId: string | null;
  users: Record<string, User>;
  tokensLoaded: boolean;
  /** Per-server MFA tickets, keyed by serverId. */
  mfaTickets: Record<string, string>;
};

/** Current server or null. */
export function useCurrentServer(): Server | null {
  const { servers, currentServerId } = useAuthState();
  return useMemo(() => servers.find((s) => s.id === currentServerId) ?? null, [servers, currentServerId]);
}

/** Current server's user or null. */
export function useCurrentUser(): User | null {
  const { users, currentServerId } = useAuthState();
  return useMemo(() => (currentServerId ? (users[currentServerId] ?? null) : null), [users, currentServerId]);
}

export type LoginResult = { success: true } | { mfaRequired: true } | { error: ApiError };

type AuthActions = {
  addServer: (baseUrl: string, name?: string) => Promise<Server>;
  removeServer: (id: string) => Promise<void>;
  setCurrentServer: (id: string | null) => void;
  updateServerInfo: (id: string, name: string) => Promise<void>;
  login: (serverId: string, body: LoginRequest) => Promise<LoginResult>;
  register: (serverId: string, body: RegisterRequest) => Promise<ApiError | null>;
  logout: (serverId: string) => Promise<void>;
  refreshSession: (serverId: string) => Promise<void>;
  submitMfaCode: (code: string) => Promise<ApiError | null>;
  clearMfaTicket: () => void;
};

const AuthStateContext = createContext<AuthState | null>(null);
const AuthActionsContext = createContext<AuthActions | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [servers, setServers] = useState<Server[]>([]);
  const [currentServerId, setCurrentServerIdState] = useState<string | null>(null);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const [mfaTickets, setMfaTickets] = useState<Record<string, string>>({});
  const mfaTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const setMfaTicketForServer = useCallback((serverId: string, ticket: string | null) => {
    const existing = mfaTimersRef.current.get(serverId);
    if (existing) {
      clearTimeout(existing);
      mfaTimersRef.current.delete(serverId);
    }
    if (ticket) {
      setMfaTickets((prev) => ({ ...prev, [serverId]: ticket }));
      // MFA tickets expire after 5 minutes.
      const timer = setTimeout(
        () => {
          setMfaTickets((prev) => {
            const next = { ...prev };
            delete next[serverId];
            return next;
          });
          mfaTimersRef.current.delete(serverId);
        },
        5 * 60 * 1000,
      );
      mfaTimersRef.current.set(serverId, timer);
    } else {
      setMfaTickets((prev) => {
        const next = { ...prev };
        delete next[serverId];
        return next;
      });
    }
  }, []);

  // Clean up all pending MFA timers on unmount.
  useEffect(() => {
    const timers = mfaTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  // Refs for stable callback access to current values.
  const serversRef = useRef(servers);
  serversRef.current = servers;
  const currentServerIdRef = useRef(currentServerId);
  currentServerIdRef.current = currentServerId;
  const mfaTicketsRef = useRef(mfaTickets);
  mfaTicketsRef.current = mfaTickets;

  function getBaseUrl(serverId: string): string | null {
    const s = serversRef.current.find((x) => x.id === serverId);
    return s?.baseUrl ?? null;
  }

  const setCurrentServer = useCallback((id: string | null) => {
    setCurrentServerIdState(id);
  }, []);

  // Refresh lock: ensures only one refresh request is in-flight per server.
  // Concurrent callers share the same promise, preventing token rotation races.
  const refreshLocks = useRef<Map<string, Promise<void>>>(new Map());

  const refreshSession = useCallback(
    async (serverId: string) => {
      const existing = refreshLocks.current.get(serverId);
      if (existing) return existing;

      // Create a deferred promise and register it in the lock map *before*
      // starting any async work. This eliminates the race window where a
      // concurrent caller could slip between the .finally() delete and a
      // subsequent .set().
      let resolve!: () => void;
      const promise = new Promise<void>((r) => {
        resolve = r;
      });
      refreshLocks.current.set(serverId, promise);

      try {
        const list = await getServers();
        const s = list.find((x) => x.id === serverId);
        if (!s) return;
        const refreshToken = await getRefreshToken(serverId);
        if (!refreshToken) {
          setUsers((u) => {
            const next = { ...u };
            delete next[serverId];
            return next;
          });
          setMfaTicketForServer(serverId, null);
          return;
        }
        const result = await apiRefresh(s.baseUrl, { refresh_token: refreshToken });
        if (!result.ok) {
          await clearTokens(serverId);
          setUsers((u) => {
            const next = { ...u };
            delete next[serverId];
            return next;
          });
          setMfaTicketForServer(serverId, null);
          return;
        }
        await setTokens(serverId, result.data.access_token, result.data.refresh_token);
        const meResult = await getMe(s.baseUrl, result.data.access_token);
        if (meResult.ok) {
          setUsers((u) => ({ ...u, [serverId]: meResult.data }));
        } else {
          setUsers((u) => {
            const next = { ...u };
            delete next[serverId];
            return next;
          });
        }
      } finally {
        refreshLocks.current.delete(serverId);
        resolve();
      }
    },
    [setMfaTicketForServer],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getServers();
      if (cancelled) return;
      setServers(list);
      setCurrentServerIdState((cur) => {
        if (list.length === 0) return null;
        if (cur && list.some((s) => s.id === cur)) return cur;
        return list[0]?.id ?? null;
      });

      const results = await Promise.all(
        list.map(async (server): Promise<[string, User] | null> => {
          try {
            const accessToken = await getAccessToken(server.id);
            if (!accessToken) return null;
            const result = await getMe(server.baseUrl, accessToken);
            if (cancelled) return null;
            if (result.ok) return [server.id, result.data];
            if (result.code === "TOKEN_EXPIRED") {
              // Use the shared refresh lock to prevent parallel refreshes.
              await refreshSession(server.id);
              if (cancelled) return null;
              const newToken = await getAccessToken(server.id);
              if (newToken) {
                const me2 = await getMe(server.baseUrl, newToken);
                if (me2.ok) return [server.id, me2.data];
              }
            } else {
              await clearTokens(server.id);
            }
          } catch {
            // Individual server token check failed — skip.
          }
          return null;
        }),
      );
      if (cancelled) return;
      const nextUsers: Record<string, User> = {};
      for (const entry of results) {
        if (entry) nextUsers[entry[0]] = entry[1];
      }
      setUsers((prev) => ({ ...prev, ...nextUsers }));
      setTokensLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  const addServer = useCallback(async (baseUrl: string, name?: string): Promise<Server> => {
    const server = await addServerToStore(baseUrl, name);
    setServers((prev) => {
      const exists = prev.find((s) => s.id === server.id);
      if (exists) {
        if (name && exists.name !== name) {
          return prev.map((s) => (s.id === server.id ? { ...s, name } : s));
        }
        return prev;
      }
      return [...prev, server];
    });
    setCurrentServerIdState(server.id);
    return server;
  }, []);

  const updateServerInfo = useCallback(async (id: string, name: string) => {
    await updateServerName(id, name);
    setServers((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }, []);

  const removeServer = useCallback(async (id: string) => {
    await clearTokens(id);
    await removeServerFromStore(id);
    setServers((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      // Auto-select first remaining server when removing the current one
      setCurrentServerIdState((cur) => {
        if (cur !== id) return cur;
        return remaining[0]?.id ?? null;
      });
      return remaining;
    });
    setUsers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const login = useCallback(
    async (serverId: string, body: LoginRequest): Promise<LoginResult> => {
      const baseUrl = getBaseUrl(serverId);
      if (!baseUrl) return { error: { ok: false, code: "NOT_FOUND", message: "Server not found" } };
      const result = await apiLogin(baseUrl, body);
      if (!result.ok) return { error: result };
      const data = result.data;
      if ("mfa_required" in data && data.mfa_required) {
        setMfaTicketForServer(serverId, data.ticket);
        return { mfaRequired: true };
      }
      if (!("user" in data) || !("access_token" in data) || !("refresh_token" in data)) {
        return { error: { ok: false, code: "INTERNAL_ERROR", message: "Unexpected login response" } };
      }
      const auth = data;
      await setTokens(serverId, auth.access_token, auth.refresh_token);
      setUsers((u) => ({ ...u, [serverId]: auth.user }));
      setMfaTicketForServer(serverId, null);
      return { success: true };
    },
    [setMfaTicketForServer],
  );

  const register = useCallback(async (serverId: string, body: RegisterRequest): Promise<ApiError | null> => {
    const baseUrl = getBaseUrl(serverId);
    if (!baseUrl) return { ok: false, code: "NOT_FOUND", message: "Server not found" };
    const result = await apiRegister(baseUrl, body);
    if (!result.ok) return result;
    const auth = result.data;
    await setTokens(serverId, auth.access_token, auth.refresh_token);
    setUsers((u) => ({ ...u, [serverId]: auth.user }));
    return null;
  }, []);

  const logout = useCallback(
    async (serverId: string) => {
      await clearTokens(serverId);
      setUsers((u) => {
        const next = { ...u };
        delete next[serverId];
        return next;
      });
      setMfaTicketForServer(serverId, null);
    },
    [setMfaTicketForServer],
  );

  const submitMfaCode = useCallback(
    async (code: string): Promise<ApiError | null> => {
      const serverId = currentServerIdRef.current;
      if (!serverId) return { ok: false, code: "UNAUTHORISED", message: "No server selected" };
      const ticket = mfaTicketsRef.current[serverId];
      if (!ticket) return { ok: false, code: "MFA_REQUIRED", message: "No MFA ticket" };
      const baseUrl = getBaseUrl(serverId);
      if (!baseUrl) return { ok: false, code: "NOT_FOUND", message: "Server not found" };
      const result = await mfaVerify(baseUrl, { ticket, code });
      if (!result.ok) return result;
      await setTokens(serverId, result.data.access_token, result.data.refresh_token);
      setUsers((u) => ({ ...u, [serverId]: result.data.user }));
      setMfaTicketForServer(serverId, null);
      return null;
    },
    [setMfaTicketForServer],
  );

  const clearMfaTicket = useCallback(() => {
    const serverId = currentServerIdRef.current;
    if (serverId) setMfaTicketForServer(serverId, null);
  }, [setMfaTicketForServer]);

  const state = useMemo<AuthState>(
    () => ({ servers, currentServerId, users, tokensLoaded, mfaTickets }),
    [servers, currentServerId, users, tokensLoaded, mfaTickets],
  );

  const actions = useMemo<AuthActions>(
    () => ({
      addServer,
      removeServer,
      setCurrentServer,
      updateServerInfo,
      login,
      register,
      logout,
      refreshSession,
      submitMfaCode,
      clearMfaTicket,
    }),
    [
      addServer,
      removeServer,
      setCurrentServer,
      updateServerInfo,
      login,
      register,
      logout,
      refreshSession,
      submitMfaCode,
      clearMfaTicket,
    ],
  );

  return (
    <AuthStateContext.Provider value={state}>
      <AuthActionsContext.Provider value={actions}>{children}</AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

export function useAuthState(): AuthState {
  const ctx = useContext(AuthStateContext);
  if (!ctx) throw new Error("useAuthState must be used within AuthProvider");
  return ctx;
}

export function useAuthActions(): AuthActions {
  const ctx = useContext(AuthActionsContext);
  if (!ctx) throw new Error("useAuthActions must be used within AuthProvider");
  return ctx;
}

export { serverIdFromBaseUrl };
