import { useCallback, useEffect, useRef } from "react";

import { startTyping, stopTyping } from "@/lib/api/client";
import { getValidToken } from "@/lib/api/fetch-with-refresh";
import { useAuthActions, useAuthState, useCurrentServer } from "@/lib/auth/auth-context";

/** Inactivity delay before we send DELETE /typing. */
const TYPING_INACTIVITY_MS = 2_000;

/**
 * Manages the sending-side typing indicator lifecycle for a channel.
 *
 * - On first keystroke: POST /typing (if not already marked as typing)
 * - On each subsequent keystroke: reset a 2-second inactivity timer
 * - When the 2-second timer fires: DELETE /typing
 * - On message send: clear local typing state (server auto-stops on message)
 * - On channel navigation: DELETE /typing for the previous channel
 */
export function useTypingIndicator(channelId: string | null) {
  const { currentServerId } = useAuthState();
  const { refreshSession } = useAuthActions();
  const currentServer = useCurrentServer();

  const isTypingRef = useRef(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callStopTyping = useCallback(
    (forChannelId: string) => {
      if (!currentServerId || !currentServer) return;
      isTypingRef.current = false;
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      void (async () => {
        try {
          const token = await getValidToken(currentServerId, refreshSession);
          if (token) {
            await stopTyping(currentServer.baseUrl, token, forChannelId);
          }
        } catch (e) {
          console.warn("Failed to send stop-typing:", e);
        }
      })();
    },
    [currentServerId, currentServer, refreshSession],
  );

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    const cId = channelId;
    if (!cId) return;
    inactivityTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        callStopTyping(cId);
      }
    }, TYPING_INACTIVITY_MS);
  }, [channelId, callStopTyping]);

  const handleTyping = useCallback(() => {
    if (!channelId || !currentServerId || !currentServer) return;

    resetInactivityTimer();

    // Only POST on the first keystroke (not already typing).
    if (isTypingRef.current) return;
    isTypingRef.current = true;

    void (async () => {
      try {
        const token = await getValidToken(currentServerId, refreshSession);
        if (token) {
          await startTyping(currentServer.baseUrl, token, channelId);
        }
      } catch (e) {
        console.warn("Failed to send start-typing:", e);
      }
    })();
  }, [channelId, currentServerId, currentServer, refreshSession, resetInactivityTimer]);

  const handleStopTyping = useCallback(() => {
    if (!channelId || !isTypingRef.current) return;
    callStopTyping(channelId);
  }, [channelId, callStopTyping]);

  /**
   * Called when a message is sent. Clears local typing state without sending
   * DELETE — the server automatically stops typing when a message is created.
   */
  const clearTypingState = useCallback(() => {
    isTypingRef.current = false;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  // Stop typing when navigating between channels.
  const prevChannelIdRef = useRef(channelId);
  useEffect(() => {
    const prev = prevChannelIdRef.current;
    prevChannelIdRef.current = channelId;
    if (prev && prev !== channelId && isTypingRef.current) {
      callStopTyping(prev);
    }
  }, [channelId, callStopTyping]);

  return { handleTyping, handleStopTyping, clearTypingState };
}
