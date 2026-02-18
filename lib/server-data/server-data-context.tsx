"use client";

import { getCategories, getChannels, getServerConfig } from "@/lib/api/client";
import { fetchWithRefresh } from "@/lib/api/fetch-with-refresh";
import { useAuthActions, useAuthState, useCurrentServer } from "@/lib/auth/auth-context";
import type { Category } from "@uncord-chat/protocol/models/category";
import type { Channel } from "@uncord-chat/protocol/models/channel";
import type { ServerConfig } from "@uncord-chat/protocol/models/server";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ServerDataState = {
  serverConfig: ServerConfig | null;
  channels: Channel[];
  categories: Category[];
  channelsLoading: boolean;
  channelsError: string | null;
  currentChannelId: string | null;
};

type ServerDataActions = {
  setCurrentChannel: (id: string | null) => void;
  refreshChannels: () => Promise<void>;
  refreshServerConfig: () => Promise<void>;
};

const ServerDataStateContext = createContext<ServerDataState | null>(null);
const ServerDataActionsContext = createContext<ServerDataActions | null>(null);

export function ServerDataProvider({ children }: { children: ReactNode }) {
  const { currentServerId } = useAuthState();
  const currentServer = useCurrentServer();
  const { refreshSession } = useAuthActions();

  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  // Reset channel selection when the active server changes (but not on initial mount,
  // where ChannelScreen may have already set it from the URL before this effect fires).
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    setCurrentChannelId(null);
  }, [currentServerId]);

  const fetchAll = useCallback(async () => {
    if (!currentServerId || !currentServer) {
      setServerConfig(null);
      setChannels([]);
      setCategories([]);
      setCurrentChannelId(null);
      return;
    }

    const id = ++fetchIdRef.current;
    setChannelsLoading(true);
    setChannelsError(null);
    const baseUrl = currentServer.baseUrl;

    const [config, chs, cats] = await Promise.all([
      fetchWithRefresh(currentServerId, baseUrl, getServerConfig, refreshSession),
      fetchWithRefresh(currentServerId, baseUrl, getChannels, refreshSession),
      fetchWithRefresh(currentServerId, baseUrl, getCategories, refreshSession),
    ]);

    // Discard stale results if the server changed while fetching.
    if (id !== fetchIdRef.current) return;

    setServerConfig(config.ok ? config.data : null);
    setChannels(chs.ok ? chs.data : []);
    setCategories(cats.ok ? cats.data : []);
    setChannelsLoading(false);
    if (!config.ok && !chs.ok && !cats.ok) {
      setChannelsError(config.reason || chs.reason || cats.reason || "Failed to load server data.");
    }
  }, [currentServerId, currentServer, refreshSession]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const refreshChannels = useCallback(async () => {
    if (!currentServerId || !currentServer) return;
    const chs = await fetchWithRefresh(currentServerId, currentServer.baseUrl, getChannels, refreshSession);
    const cats = await fetchWithRefresh(currentServerId, currentServer.baseUrl, getCategories, refreshSession);
    setChannels(chs.ok ? chs.data : []);
    setCategories(cats.ok ? cats.data : []);
  }, [currentServerId, currentServer, refreshSession]);

  const refreshServerConfigAction = useCallback(async () => {
    if (!currentServerId || !currentServer) return;
    const config = await fetchWithRefresh(currentServerId, currentServer.baseUrl, getServerConfig, refreshSession);
    setServerConfig(config.ok ? config.data : null);
  }, [currentServerId, currentServer, refreshSession]);

  const setCurrentChannel = useCallback((id: string | null) => {
    setCurrentChannelId(id);
  }, []);

  const state = useMemo<ServerDataState>(
    () => ({ serverConfig, channels, categories, channelsLoading, channelsError, currentChannelId }),
    [serverConfig, channels, categories, channelsLoading, channelsError, currentChannelId],
  );

  const actions = useMemo<ServerDataActions>(
    () => ({ setCurrentChannel, refreshChannels, refreshServerConfig: refreshServerConfigAction }),
    [setCurrentChannel, refreshChannels, refreshServerConfigAction],
  );

  return (
    <ServerDataStateContext.Provider value={state}>
      <ServerDataActionsContext.Provider value={actions}>{children}</ServerDataActionsContext.Provider>
    </ServerDataStateContext.Provider>
  );
}

export function useServerDataState(): ServerDataState {
  const ctx = useContext(ServerDataStateContext);
  if (!ctx) throw new Error("useServerDataState must be used within ServerDataProvider");
  return ctx;
}

export function useServerDataActions(): ServerDataActions {
  const ctx = useContext(ServerDataActionsContext);
  if (!ctx) throw new Error("useServerDataActions must be used within ServerDataProvider");
  return ctx;
}
