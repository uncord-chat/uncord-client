import { createElement } from "react";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStartTyping = jest.fn().mockResolvedValue(undefined);
const mockStopTyping = jest.fn().mockResolvedValue(undefined);
const mockGetValidToken = jest.fn().mockResolvedValue("test-token");

jest.mock("@/lib/api/client", () => ({
  startTyping: (...args: unknown[]) => mockStartTyping(...args),
  stopTyping: (...args: unknown[]) => mockStopTyping(...args),
}));

jest.mock("@/lib/api/fetch-with-refresh", () => ({
  getValidToken: (...args: unknown[]) => mockGetValidToken(...args),
}));

const mockUseAuthState = jest.fn();
const mockUseAuthActions = jest.fn();
const mockUseCurrentServer = jest.fn();

jest.mock("@/lib/auth/auth-context", () => ({
  useAuthState: () => mockUseAuthState(),
  useAuthActions: () => mockUseAuthActions(),
  useCurrentServer: () => mockUseCurrentServer(),
}));

import { useTypingIndicator } from "@/lib/typing/use-typing-indicator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TypingIndicatorResult = ReturnType<typeof useTypingIndicator>;

function renderHook(channelId: string | null): {
  result: { current: TypingIndicatorResult };
  rerender: (channelId: string | null) => void;
  unmount: () => void;
} {
  const result: { current: TypingIndicatorResult } = {} as { current: TypingIndicatorResult };
  let currentChannelId = channelId;

  function TestComponent({ cId }: { cId: string | null }) {
    result.current = useTypingIndicator(cId);
    return null;
  }

  let root: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(createElement(TestComponent, { cId: currentChannelId }));
  });

  return {
    result,
    rerender: (newChannelId: string | null) => {
      currentChannelId = newChannelId;
      act(() => {
        root.update(createElement(TestComponent, { cId: currentChannelId }));
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

describe("useTypingIndicator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockUseAuthState.mockReturnValue({ currentServerId: "s1" });
    mockUseAuthActions.mockReturnValue({ refreshSession: jest.fn() });
    mockUseCurrentServer.mockReturnValue({ id: "s1", baseUrl: "http://localhost" });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns handleTyping, handleStopTyping, and clearTypingState callbacks", () => {
    const { result } = renderHook("ch1");

    expect(typeof result.current.handleTyping).toBe("function");
    expect(typeof result.current.handleStopTyping).toBe("function");
    expect(typeof result.current.clearTypingState).toBe("function");
  });

  it("sends startTyping on first handleTyping call", async () => {
    const { result } = renderHook("ch1");

    await act(async () => {
      result.current.handleTyping();
      // Allow microtasks (the async token fetch + API call) to resolve.
      await Promise.resolve();
    });

    expect(mockGetValidToken).toHaveBeenCalledWith("s1", expect.any(Function));
    expect(mockStartTyping).toHaveBeenCalledWith("http://localhost", "test-token", "ch1");
  });

  it("does not send startTyping on subsequent calls while already typing", async () => {
    const { result } = renderHook("ch1");

    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    mockStartTyping.mockClear();

    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    expect(mockStartTyping).not.toHaveBeenCalled();
  });

  it("sends stopTyping after inactivity timeout (2 seconds)", async () => {
    const { result } = renderHook("ch1");

    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    mockGetValidToken.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(mockStopTyping).toHaveBeenCalledWith("http://localhost", "test-token", "ch1");
  });

  it("resets inactivity timer on repeated handleTyping calls", async () => {
    const { result } = renderHook("ch1");

    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    // Advance 1.5s (should not have stopped yet).
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockStopTyping).not.toHaveBeenCalled();

    // Another keystroke resets the 2s timer.
    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    // Advance 1.5s more (total 3s from first keystroke but 1.5s from reset).
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(mockStopTyping).not.toHaveBeenCalled();

    // Advance another 0.5s (now 2s from last keystroke).
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(mockStopTyping).toHaveBeenCalled();
  });

  it("handleStopTyping sends stopTyping immediately", async () => {
    const { result } = renderHook("ch1");

    // Start typing first.
    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    await act(async () => {
      result.current.handleStopTyping();
      await Promise.resolve();
    });

    expect(mockStopTyping).toHaveBeenCalledWith("http://localhost", "test-token", "ch1");
  });

  it("handleStopTyping does nothing when not currently typing", async () => {
    const { result } = renderHook("ch1");

    await act(async () => {
      result.current.handleStopTyping();
      await Promise.resolve();
    });

    expect(mockStopTyping).not.toHaveBeenCalled();
  });

  it("clearTypingState does not call stopTyping API", async () => {
    const { result } = renderHook("ch1");

    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    mockStopTyping.mockClear();

    act(() => {
      result.current.clearTypingState();
    });

    expect(mockStopTyping).not.toHaveBeenCalled();
  });

  it("does nothing when channelId is null", async () => {
    const { result } = renderHook(null);

    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    expect(mockStartTyping).not.toHaveBeenCalled();
  });

  it("does nothing when currentServerId is null", async () => {
    mockUseAuthState.mockReturnValue({ currentServerId: null });

    const { result } = renderHook("ch1");

    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    expect(mockStartTyping).not.toHaveBeenCalled();
  });

  it("does nothing when currentServer is null", async () => {
    mockUseCurrentServer.mockReturnValue(null);

    const { result } = renderHook("ch1");

    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    expect(mockStartTyping).not.toHaveBeenCalled();
  });

  it("sends stopTyping for previous channel when channelId changes", async () => {
    const { result, rerender } = renderHook("ch1");

    // Start typing in ch1.
    await act(async () => {
      result.current.handleTyping();
      await Promise.resolve();
    });

    mockStopTyping.mockClear();
    mockGetValidToken.mockClear();

    // Switch to ch2 — should stop typing in ch1.
    await act(async () => {
      rerender("ch2");
      await Promise.resolve();
    });

    expect(mockStopTyping).toHaveBeenCalledWith("http://localhost", "test-token", "ch1");
  });
});
