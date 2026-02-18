import type { MessageDeleteData } from "@uncord-chat/protocol/models/gateway";
import type { Message } from "@uncord-chat/protocol/models/message";
import { useRef } from "react";

import { useGatewayEvent } from "@/lib/gateway/gateway-context";

type MessageUpdater = (updater: (prev: Message[]) => Message[]) => void;

// ---------------------------------------------------------------------------
// Type guards — validate gateway payloads before using them.
// ---------------------------------------------------------------------------

function isMessage(d: unknown): d is Message {
  return typeof d === "object" && d !== null && "id" in d && "channel_id" in d && "content" in d;
}

function isMessageDeleteData(d: unknown): d is MessageDeleteData {
  return typeof d === "object" && d !== null && "id" in d && "channel_id" in d;
}

/**
 * Subscribes to MESSAGE_CREATE, MESSAGE_UPDATE, and MESSAGE_DELETE gateway
 * events and injects them into the channel's message state.
 *
 * @param channelId  The currently viewed channel ID.
 * @param setMessages  State setter from useChannelMessages.
 */
export function useGatewayMessages(channelId: string | null, setMessages: MessageUpdater): void {
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  useGatewayEvent("MESSAGE_CREATE", (data) => {
    if (!isMessage(data)) return;
    if (data.channel_id !== channelIdRef.current) return;

    setMessages((prev) => {
      // Deduplicate against optimistic sends (same id already in the list).
      if (prev.some((m) => m.id === data.id)) return prev;
      return [data, ...prev];
    });
  });

  useGatewayEvent("MESSAGE_UPDATE", (data) => {
    if (!isMessage(data)) return;
    if (data.channel_id !== channelIdRef.current) return;

    setMessages((prev) => prev.map((m) => (m.id === data.id ? data : m)));
  });

  useGatewayEvent("MESSAGE_DELETE", (data) => {
    if (!isMessageDeleteData(data)) return;
    if (data.channel_id !== channelIdRef.current) return;

    setMessages((prev) => prev.filter((m) => m.id !== data.id));
  });
}
