import { createElement } from "react";
import renderer, { act } from "react-test-renderer";
import type { Message } from "@uncord-chat/protocol/models/message";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetMessages = jest.fn();
const mockSendMessage = jest.fn();

jest.mock("@/lib/api/client", () => ({
  getMessages: (...args: unknown[]) => mockGetMessages(...args),
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

const mockFetchWithRefresh = jest.fn();

jest.mock("@/lib/api/fetch-with-refresh", () => ({
  fetchWithRefresh: (...args: unknown[]) => mockFetchWithRefresh(...args),
}));

const mockUseAuthState = jest.fn();
const mockUseAuthActions = jest.fn();
const mockUseCurrentServer = jest.fn();

jest.mock("@/lib/auth/auth-context", () => ({
  useAuthState: () => mockUseAuthState(),
  useAuthActions: () => mockUseAuthActions(),
  useCurrentServer: () => mockUseCurrentServer(),
}));

import { useChannelMessages } from "@/lib/messages/use-channel-messages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ChannelMessagesResult = ReturnType<typeof useChannelMessages>;

function makeMessage(overrides: Partial<Message> & { id: string; channel_id: string }): Message {
  return {
    content: "hello",
    author: { id: "u1", username: "alice" },
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  } as Message;
}

function renderHook(channelId: string | null): {
  result: { current: ChannelMessagesResult };
  rerender: (channelId: string | null) => void;
  unmount: () => void;
} {
  const result: { current: ChannelMessagesResult } = {} as { current: ChannelMessagesResult };

  function TestComponent({ cId }: { cId: string | null }) {
    result.current = useChannelMessages(cId);
    return null;
  }

  let root: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(createElement(TestComponent, { cId: channelId }));
  });

  return {
    result,
    rerender: (newChannelId: string | null) => {
      act(() => {
        root.update(createElement(TestComponent, { cId: newChannelId }));
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useChannelMessages", () => {
  const refreshSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuthState.mockReturnValue({ currentServerId: "s1" });
    mockUseAuthActions.mockReturnValue({ refreshSession });
    mockUseCurrentServer.mockReturnValue({ id: "s1", baseUrl: "http://localhost" });

    // Default: resolve with empty messages.
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: [] });
  });

  it("returns initial state before fetch completes", () => {
    // Prevent auto-resolution so we can inspect intermediate state.
    mockFetchWithRefresh.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook("ch1");

    expect(result.current.loading).toBe(true);
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loadingMore).toBe(false);
  });

  it("fetches messages on mount and populates state", async () => {
    const msgs = [makeMessage({ id: "m1", channel_id: "ch1" })];
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: msgs });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    expect(hookResult!.current.loading).toBe(false);
    expect(hookResult!.current.messages).toEqual(msgs);
    expect(hookResult!.current.error).toBeNull();
  });

  it("sets error state when fetch fails", async () => {
    mockFetchWithRefresh.mockResolvedValue({ ok: false, reason: "Network error" });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    expect(hookResult!.current.loading).toBe(false);
    expect(hookResult!.current.messages).toEqual([]);
    expect(hookResult!.current.error).toBe("Network error");
  });

  it("resets state when channelId is null", () => {
    const { result } = renderHook(null);

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("resets state when currentServerId is null", () => {
    mockUseAuthState.mockReturnValue({ currentServerId: null });

    const { result } = renderHook("ch1");

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("resets state when currentServer is null", () => {
    mockUseCurrentServer.mockReturnValue(null);

    const { result } = renderHook("ch1");

    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("hasMore is true when fetch returns PAGE_SIZE messages", async () => {
    // PAGE_SIZE is 50 in the source.
    const msgs = Array.from({ length: 50 }, (_, i) => makeMessage({ id: `m${i}`, channel_id: "ch1" }));
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: msgs });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    expect(hookResult!.current.hasMore).toBe(true);
  });

  it("hasMore is false when fetch returns fewer than PAGE_SIZE messages", async () => {
    const msgs = [makeMessage({ id: "m1", channel_id: "ch1" })];
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: msgs });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    expect(hookResult!.current.hasMore).toBe(false);
  });

  it("setMessages applies an updater function", async () => {
    const msgs = [makeMessage({ id: "m1", channel_id: "ch1", content: "original" })];
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: msgs });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    const updated = makeMessage({ id: "m1", channel_id: "ch1", content: "updated" });
    act(() => {
      hookResult!.current.setMessages((prev) => prev.map((m) => (m.id === "m1" ? updated : m)));
    });

    expect(hookResult!.current.messages[0].content).toBe("updated");
  });

  it("sendMessage calls fetchWithRefresh and adds message to state", async () => {
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: [] });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    const sentMsg = makeMessage({ id: "m99", channel_id: "ch1", content: "sent" });
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: sentMsg });

    await act(async () => {
      await hookResult!.current.sendMessage("sent");
    });

    expect(hookResult!.current.messages).toContainEqual(sentMsg);
  });

  it("sendMessage sets error when API fails", async () => {
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: [] });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    mockFetchWithRefresh.mockResolvedValue({ ok: false, reason: "Send failed" });

    await act(async () => {
      await hookResult!.current.sendMessage("test");
    });

    expect(hookResult!.current.error).toBe("Send failed");
  });

  it("sendMessage deduplicates messages that are already in state", async () => {
    const existing = makeMessage({ id: "m1", channel_id: "ch1" });
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: [existing] });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    // Simulate send returning the same message ID (gateway already added it).
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: existing });

    await act(async () => {
      await hookResult!.current.sendMessage("hello");
    });

    const ids = hookResult!.current.messages.map((m) => m.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids.length).toBe(uniqueIds.length);
  });

  it("sendMessage does nothing when channelId is null", async () => {
    mockFetchWithRefresh.mockClear();

    const { result } = renderHook(null);

    await act(async () => {
      await result.current.sendMessage("test");
    });

    // Only the initial render triggers, not sendMessage.
    expect(mockFetchWithRefresh).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // loadMore
  // ---------------------------------------------------------------------------

  it("loadMore fetches older messages and appends them", async () => {
    // Initial fetch returns PAGE_SIZE messages so hasMore is true.
    const initialMsgs = Array.from({ length: 50 }, (_, i) => makeMessage({ id: `m${i}`, channel_id: "ch1" }));
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: initialMsgs });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    expect(hookResult!.current.hasMore).toBe(true);
    expect(hookResult!.current.messages).toHaveLength(50);

    // loadMore returns 10 older messages.
    const olderMsgs = Array.from({ length: 10 }, (_, i) => makeMessage({ id: `old${i}`, channel_id: "ch1" }));
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: olderMsgs });

    await act(async () => {
      await hookResult!.current.loadMore();
    });

    expect(hookResult!.current.messages).toHaveLength(60);
    expect(hookResult!.current.loadingMore).toBe(false);
    // Returned fewer than PAGE_SIZE, so no more pages.
    expect(hookResult!.current.hasMore).toBe(false);
  });

  it("loadMore does nothing when hasMore is false", async () => {
    // Initial fetch returns fewer than PAGE_SIZE.
    const msgs = [makeMessage({ id: "m1", channel_id: "ch1" })];
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: msgs });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    expect(hookResult!.current.hasMore).toBe(false);
    mockFetchWithRefresh.mockClear();

    await act(async () => {
      await hookResult!.current.loadMore();
    });

    // Should not have made another fetch call.
    expect(mockFetchWithRefresh).not.toHaveBeenCalled();
  });

  it("loadMore resets loadingMore on failure", async () => {
    // Initial fetch returns PAGE_SIZE messages so hasMore is true.
    const initialMsgs = Array.from({ length: 50 }, (_, i) => makeMessage({ id: `m${i}`, channel_id: "ch1" }));
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: initialMsgs });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    // loadMore fails.
    mockFetchWithRefresh.mockResolvedValue({ ok: false, reason: "Network error" });

    await act(async () => {
      await hookResult!.current.loadMore();
    });

    // loadingMore must be reset to false so pagination is not permanently frozen.
    expect(hookResult!.current.loadingMore).toBe(false);
    expect(hookResult!.current.error).toBe("Network error");
  });

  it("loadMore can be retried after a failure", async () => {
    // Initial fetch returns PAGE_SIZE messages.
    const initialMsgs = Array.from({ length: 50 }, (_, i) => makeMessage({ id: `m${i}`, channel_id: "ch1" }));
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: initialMsgs });

    let hookResult: { current: ChannelMessagesResult };
    await act(async () => {
      const rendered = renderHook("ch1");
      hookResult = rendered.result;
      await Promise.resolve();
    });

    // First loadMore fails.
    mockFetchWithRefresh.mockResolvedValue({ ok: false, reason: "Temporary error" });
    await act(async () => {
      await hookResult!.current.loadMore();
    });

    expect(hookResult!.current.loadingMore).toBe(false);

    // Retry succeeds.
    const olderMsgs = Array.from({ length: 5 }, (_, i) => makeMessage({ id: `retry${i}`, channel_id: "ch1" }));
    mockFetchWithRefresh.mockResolvedValue({ ok: true, data: olderMsgs });

    await act(async () => {
      await hookResult!.current.loadMore();
    });

    expect(hookResult!.current.messages).toHaveLength(55);
    expect(hookResult!.current.loadingMore).toBe(false);
  });

  it("loadMore does nothing when channelId is null", async () => {
    mockFetchWithRefresh.mockClear();

    const { result } = renderHook(null);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchWithRefresh).not.toHaveBeenCalled();
  });
});
