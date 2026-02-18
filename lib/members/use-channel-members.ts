import { useCallback, useEffect, useRef, useState } from "react";

import { listChannelMembers } from "@/lib/api/client";
import { fetchWithRefresh } from "@/lib/api/fetch-with-refresh";
import { useAuthActions, useAuthState, useCurrentServer } from "@/lib/auth/auth-context";
import { useGatewayEvent } from "@/lib/gateway/gateway-context";
import type { Member } from "@uncord-chat/protocol/models/member";

const PAGE_SIZE = 100;
const DEBOUNCE_MS = 300;

/**
 * Fetches all members with access to the given channel via paginated REST calls.
 * Refetches when gateway member events fire (debounced).
 */
export function useChannelMembers(channelId: string | null): { channelMembers: Member[]; loading: boolean } {
  const { currentServerId } = useAuthState();
  const currentServer = useCurrentServer();
  const { refreshSession } = useAuthActions();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!channelId || !currentServerId || !currentServer) {
      setMembers([]);
      return;
    }

    const id = ++fetchIdRef.current;
    const baseUrl = currentServer.baseUrl;
    setLoading(true);

    const allMembers: Member[] = [];
    let after: string | undefined;

    // Paginate until exhausted.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await fetchWithRefresh(
        currentServerId,
        baseUrl,
        (url, token) => listChannelMembers(url, token, channelId, { limit: PAGE_SIZE, after }),
        refreshSession,
      );

      if (id !== fetchIdRef.current) return;

      if (!result.ok) {
        setLoading(false);
        return;
      }

      allMembers.push(...result.data);

      if (result.data.length < PAGE_SIZE) break;
      after = result.data[result.data.length - 1]!.user.id;
    }

    if (id !== fetchIdRef.current) return;
    setMembers(allMembers);
    setLoading(false);
  }, [channelId, currentServerId, currentServer, refreshSession]);

  // Fetch on mount / channel change.
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Debounced refetch on gateway member events.
  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchAll();
    }, DEBOUNCE_MS);
  }, [fetchAll]);

  // Clean up debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useGatewayEvent("MEMBER_ADD", debouncedRefetch);
  useGatewayEvent("MEMBER_UPDATE", debouncedRefetch);
  useGatewayEvent("MEMBER_REMOVE", debouncedRefetch);

  return { channelMembers: members, loading };
}
