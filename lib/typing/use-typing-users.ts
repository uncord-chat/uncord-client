import { useEffect, useRef, useState } from "react";

import { useGatewayEvent } from "@/lib/gateway/gateway-context";
import { useCurrentUser } from "@/lib/auth/auth-context";

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isTypingStartData(d: unknown): d is { channel_id: string; user_id: string; timestamp: string } {
  return (
    typeof d === "object" &&
    d !== null &&
    "channel_id" in d &&
    "user_id" in d &&
    "timestamp" in d &&
    typeof (d as { channel_id: unknown }).channel_id === "string" &&
    typeof (d as { user_id: unknown }).user_id === "string"
  );
}

function isTypingStopData(d: unknown): d is { channel_id: string; user_id: string } {
  return (
    typeof d === "object" &&
    d !== null &&
    "channel_id" in d &&
    "user_id" in d &&
    typeof (d as { channel_id: unknown }).channel_id === "string" &&
    typeof (d as { user_id: unknown }).user_id === "string"
  );
}

function isMessageCreateData(d: unknown): d is { channel_id: string; author: { id: string } } {
  return (
    typeof d === "object" &&
    d !== null &&
    "channel_id" in d &&
    "author" in d &&
    typeof (d as { author: unknown }).author === "object" &&
    (d as { author: { id: unknown } }).author !== null &&
    "id" in (d as { author: { id: unknown } }).author &&
    typeof (d as { author: { id: string } }).author.id === "string"
  );
}

/** Safety timeout: hide indicators after 12 seconds since last TYPING_START. */
const TYPING_EXPIRY_MS = 12_000;
const CLEANUP_INTERVAL_MS = 1_000;

/**
 * Tracks which users are currently typing in the given channel.
 * Returns an array of user IDs (excluding the current user).
 *
 * Hides a user's typing indicator on:
 * - TYPING_STOP event for that user/channel
 * - MESSAGE_CREATE from the same user in the same channel
 * - Safety timeout (12 s since last TYPING_START)
 */
export function useTypingUsers(channelId: string | null): string[] {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const currentUser = useCurrentUser();

  // Map of userId → expiry timestamp (ms).
  const typingMapRef = useRef<Map<string, number>>(new Map());
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const currentUserIdRef = useRef(currentUser?.id);
  currentUserIdRef.current = currentUser?.id;

  // Reset typing state when channel changes.
  useEffect(() => {
    typingMapRef.current.clear();
    setTypingUsers([]);
  }, [channelId]);

  // Helper: remove a user from the typing map and sync state.
  const removeUser = (userId: string) => {
    if (typingMapRef.current.delete(userId)) {
      setTypingUsers(Array.from(typingMapRef.current.keys()));
    }
  };

  // Subscribe to TYPING_START events.
  useGatewayEvent("TYPING_START", (data) => {
    if (!isTypingStartData(data)) return;
    if (data.channel_id !== channelIdRef.current) return;
    if (data.user_id === currentUserIdRef.current) return;

    typingMapRef.current.set(data.user_id, Date.now() + TYPING_EXPIRY_MS);
    setTypingUsers(Array.from(typingMapRef.current.keys()));
  });

  // Subscribe to TYPING_STOP events.
  useGatewayEvent("TYPING_STOP", (data) => {
    if (!isTypingStopData(data)) return;
    if (data.channel_id !== channelIdRef.current) return;
    removeUser(data.user_id);
  });

  // Hide typing indicator immediately when a user sends a message.
  useGatewayEvent("MESSAGE_CREATE", (data) => {
    if (!isMessageCreateData(data)) return;
    if (data.channel_id !== channelIdRef.current) return;
    removeUser(data.author.id);
  });

  // Periodic cleanup of expired entries.
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [userId, expiry] of typingMapRef.current) {
        if (expiry <= now) {
          typingMapRef.current.delete(userId);
          changed = true;
        }
      }
      if (changed) {
        setTypingUsers(Array.from(typingMapRef.current.keys()));
      }
    }, CLEANUP_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return typingUsers;
}
