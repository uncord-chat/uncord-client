import { getMessages, sendMessage as apiSendMessage } from "@/lib/api/client";
import { fetchWithRefresh } from "@/lib/api/fetch-with-refresh";
import { useAuthActions, useAuthState, useCurrentServer } from "@/lib/auth/auth-context";
import type { Message } from "@uncord-chat/protocol/models/message";
import { useCallback, useEffect, useReducer, useRef } from "react";

const PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Reducer — single source of truth for message state.
// ---------------------------------------------------------------------------

type State = {
  messages: Message[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
};

type Action =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; messages: Message[] }
  | { type: "FETCH_ERROR"; error: string }
  | { type: "LOAD_MORE_START" }
  | { type: "LOAD_MORE_SUCCESS"; messages: Message[] }
  | { type: "SEND_SUCCESS"; message: Message }
  | { type: "SEND_ERROR"; error: string }
  | { type: "LOAD_MORE_ERROR"; error: string }
  | { type: "SET_MESSAGES"; updater: (prev: Message[]) => Message[] }
  | { type: "RESET" };

const initialState: State = {
  messages: [],
  loading: false,
  loadingMore: false,
  hasMore: true,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return {
        ...state,
        loading: false,
        messages: action.messages,
        hasMore: action.messages.length >= PAGE_SIZE,
      };
    case "FETCH_ERROR":
      return { ...state, loading: false, messages: [], hasMore: false, error: action.error };
    case "LOAD_MORE_START":
      return { ...state, loadingMore: true };
    case "LOAD_MORE_SUCCESS":
      return {
        ...state,
        loadingMore: false,
        messages: [...state.messages, ...action.messages],
        hasMore: action.messages.length >= PAGE_SIZE,
      };
    case "SEND_SUCCESS":
      // Deduplicate — the gateway MESSAGE_CREATE may have already added this message.
      if (state.messages.some((m) => m.id === action.message.id)) return state;
      return { ...state, messages: [action.message, ...state.messages] };
    case "SEND_ERROR":
      return { ...state, error: action.error };
    case "LOAD_MORE_ERROR":
      return { ...state, loadingMore: false, error: action.error };
    case "SET_MESSAGES":
      return { ...state, messages: action.updater(state.messages) };
    case "RESET":
      return initialState;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChannelMessages(channelId: string | null) {
  const { currentServerId } = useAuthState();
  const currentServer = useCurrentServer();
  const { refreshSession } = useAuthActions();

  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!channelId || !currentServerId || !currentServer) {
      dispatch({ type: "RESET" });
      return;
    }

    const id = ++fetchIdRef.current;
    const baseUrl = currentServer.baseUrl;

    (async () => {
      dispatch({ type: "FETCH_START" });

      const result = await fetchWithRefresh(
        currentServerId,
        baseUrl,
        (url, token) => getMessages(url, token, channelId, { limit: PAGE_SIZE }),
        refreshSession,
      );

      if (id !== fetchIdRef.current) return;

      if (result.ok) {
        dispatch({ type: "FETCH_SUCCESS", messages: result.data });
      } else {
        dispatch({ type: "FETCH_ERROR", error: result.reason });
      }
    })();
  }, [channelId, currentServerId, currentServer, refreshSession]);

  const loadMore = useCallback(async () => {
    if (!channelId || !currentServerId || !currentServer) return;
    const { loadingMore, hasMore, messages } = stateRef.current;
    if (loadingMore || !hasMore) return;
    const oldest = messages[messages.length - 1];
    if (!oldest) return;

    const id = ++fetchIdRef.current;
    dispatch({ type: "LOAD_MORE_START" });

    const result = await fetchWithRefresh(
      currentServerId,
      currentServer.baseUrl,
      (url, token) => getMessages(url, token, channelId, { limit: PAGE_SIZE, before: oldest.id }),
      refreshSession,
    );

    if (id !== fetchIdRef.current) return;
    if (result.ok) {
      dispatch({ type: "LOAD_MORE_SUCCESS", messages: result.data });
    } else {
      dispatch({ type: "LOAD_MORE_ERROR", error: result.reason });
    }
  }, [channelId, currentServerId, currentServer, refreshSession]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!channelId || !currentServerId || !currentServer) return;

      const result = await fetchWithRefresh(
        currentServerId,
        currentServer.baseUrl,
        (url, token) => apiSendMessage(url, token, channelId, { content }),
        refreshSession,
      );

      if (result.ok) {
        dispatch({ type: "SEND_SUCCESS", message: result.data });
      } else {
        dispatch({ type: "SEND_ERROR", error: result.reason });
      }
    },
    [channelId, currentServerId, currentServer, refreshSession],
  );

  const setMessages = useCallback((updater: (prev: Message[]) => Message[]) => {
    dispatch({ type: "SET_MESSAGES", updater });
  }, []);

  return {
    messages: state.messages,
    setMessages,
    loading: state.loading,
    loadingMore: state.loadingMore,
    hasMore: state.hasMore,
    error: state.error,
    sendMessage,
    loadMore,
  };
}
