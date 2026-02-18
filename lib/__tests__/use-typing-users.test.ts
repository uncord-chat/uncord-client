import { createElement } from "react";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — capture gateway event handlers so we can invoke them in tests.
// ---------------------------------------------------------------------------

const gatewayHandlers: Record<string, ((data: unknown) => void)[]> = {};

jest.mock("@/lib/gateway/gateway-context", () => ({
  useGatewayEvent: (event: string, handler: (data: unknown) => void) => {
    if (!gatewayHandlers[event]) gatewayHandlers[event] = [];
    gatewayHandlers[event].push(handler);
  },
}));

jest.mock("@/lib/auth/auth-context", () => ({
  useCurrentUser: jest.fn(),
}));

import { useCurrentUser } from "@/lib/auth/auth-context";
import { useTypingUsers } from "@/lib/typing/use-typing-users";

const mockUseCurrentUser = useCurrentUser as jest.MockedFunction<typeof useCurrentUser>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emit(event: string, data: unknown) {
  const handlers = gatewayHandlers[event];
  if (handlers) {
    for (const h of handlers) h(data);
  }
}

function renderHook(channelId: string | null): {
  result: { current: string[] };
  rerender: (channelId: string | null) => void;
  unmount: () => void;
} {
  const result: { current: string[] } = { current: [] };

  function TestComponent({ cId }: { cId: string | null }) {
    result.current = useTypingUsers(cId);
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

describe("useTypingUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Clear captured handlers between tests.
    for (const key of Object.keys(gatewayHandlers)) {
      delete gatewayHandlers[key];
    }

    mockUseCurrentUser.mockReturnValue({ id: "me", username: "myself" } as ReturnType<typeof useCurrentUser>);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts with an empty typing users list", () => {
    const { result } = renderHook("ch1");
    expect(result.current).toEqual([]);
  });

  it("adds a user on TYPING_START", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });

    expect(result.current).toEqual(["u1"]);
  });

  it("ignores TYPING_START from the current user", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "me", timestamp: "2025-01-01T00:00:00Z" });
    });

    expect(result.current).toEqual([]);
  });

  it("ignores TYPING_START for a different channel", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch2", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });

    expect(result.current).toEqual([]);
  });

  it("removes a user on TYPING_STOP", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });
    expect(result.current).toEqual(["u1"]);

    act(() => {
      emit("TYPING_STOP", { channel_id: "ch1", user_id: "u1" });
    });
    expect(result.current).toEqual([]);
  });

  it("ignores TYPING_STOP for a different channel", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });

    act(() => {
      emit("TYPING_STOP", { channel_id: "ch2", user_id: "u1" });
    });

    expect(result.current).toEqual(["u1"]);
  });

  it("removes a user on MESSAGE_CREATE from that user", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });
    expect(result.current).toEqual(["u1"]);

    act(() => {
      emit("MESSAGE_CREATE", { channel_id: "ch1", author: { id: "u1" } });
    });
    expect(result.current).toEqual([]);
  });

  it("ignores MESSAGE_CREATE from a different channel", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });

    act(() => {
      emit("MESSAGE_CREATE", { channel_id: "ch2", author: { id: "u1" } });
    });

    expect(result.current).toEqual(["u1"]);
  });

  it("expires typing users after 12 seconds", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });
    expect(result.current).toEqual(["u1"]);

    // Advance past the 12-second expiry + 1-second cleanup interval.
    act(() => {
      jest.advanceTimersByTime(13_000);
    });
    expect(result.current).toEqual([]);
  });

  it("tracks multiple users simultaneously", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
      emit("TYPING_START", { channel_id: "ch1", user_id: "u2", timestamp: "2025-01-01T00:00:00Z" });
    });

    expect(result.current).toContain("u1");
    expect(result.current).toContain("u2");
    expect(result.current).toHaveLength(2);
  });

  it("only removes the user that stopped typing, keeping others", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
      emit("TYPING_START", { channel_id: "ch1", user_id: "u2", timestamp: "2025-01-01T00:00:00Z" });
    });

    act(() => {
      emit("TYPING_STOP", { channel_id: "ch1", user_id: "u1" });
    });

    expect(result.current).toEqual(["u2"]);
  });

  it("resets typing users when channelId changes", () => {
    const { result, rerender } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });
    expect(result.current).toEqual(["u1"]);

    rerender("ch2");
    expect(result.current).toEqual([]);
  });

  it("returns empty array when channelId is null", () => {
    const { result } = renderHook(null);
    expect(result.current).toEqual([]);
  });

  it("ignores events with invalid data shape", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { invalid: true });
      emit("TYPING_START", null);
      emit("TYPING_START", "string");
      emit("TYPING_STOP", { no_channel: true });
      emit("MESSAGE_CREATE", { channel_id: "ch1" }); // missing author
    });

    expect(result.current).toEqual([]);
  });

  it("refreshes expiry when same user sends TYPING_START again", () => {
    const { result } = renderHook("ch1");

    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:00Z" });
    });

    // Advance 10 seconds.
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current).toEqual(["u1"]);

    // Refresh by sending TYPING_START again.
    act(() => {
      emit("TYPING_START", { channel_id: "ch1", user_id: "u1", timestamp: "2025-01-01T00:00:01Z" });
    });

    // Advance another 10 seconds (total 20s from first start, 10s from refresh).
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current).toEqual(["u1"]);

    // Advance past the new expiry.
    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(result.current).toEqual([]);
  });
});
