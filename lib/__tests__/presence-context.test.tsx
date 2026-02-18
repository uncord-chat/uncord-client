import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Capture the handlers registered via useGatewayEvent so we can invoke them
// in tests to simulate gateway dispatch events.
const gatewayHandlers: Record<string, (data: unknown) => void> = {};

jest.mock("@/lib/gateway/gateway-context", () => ({
  useGateway: jest.fn(() => null),
  useGatewayEvent: jest.fn((event: string, handler: (data: unknown) => void) => {
    gatewayHandlers[event] = handler;
  }),
}));

import { PresenceProvider, usePresenceState, usePresenceActions } from "@/lib/presence/presence-context";

// ---------------------------------------------------------------------------
// Error boundary helper for testing React 19 render errors
// ---------------------------------------------------------------------------

let capturedError: Error | null = null;

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error): void {
    capturedError = error;
  }
  render(): React.ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Test helper — renders a hook inside a provider and captures its value
// ---------------------------------------------------------------------------

const renderers: ReactTestRenderer[] = [];

function renderHookInProvider<T>(useHook: () => T): { result: { current: T } } {
  const result = { current: undefined as T };

  function HookCapture() {
    result.current = useHook();
    return null;
  }

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <PresenceProvider>
        <HookCapture />
      </PresenceProvider>,
    );
  });
  renderers.push(renderer);
  return { result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PresenceProvider", () => {
  beforeEach(() => {
    capturedError = null;
    for (const key of Object.keys(gatewayHandlers)) {
      delete gatewayHandlers[key];
    }
  });

  afterEach(() => {
    // Unmount all renderers to avoid cross-test contamination.
    for (const r of renderers) {
      act(() => {
        r.unmount();
      });
    }
    renderers.length = 0;
  });

  // ---- Hook-outside-provider tests ----

  describe("usePresenceState", () => {
    it("throws when used outside PresenceProvider", () => {
      const spy = jest.spyOn(console, "error").mockImplementation();

      function BadComponent() {
        usePresenceState();
        return null;
      }

      act(() => {
        create(
          <ErrorBoundary>
            <BadComponent />
          </ErrorBoundary>,
        );
      });

      expect(capturedError).not.toBeNull();
      expect(capturedError!.message).toContain("usePresenceState must be used within PresenceProvider");
      spy.mockRestore();
    });
  });

  describe("usePresenceActions", () => {
    it("throws when used outside PresenceProvider", () => {
      const spy = jest.spyOn(console, "error").mockImplementation();

      function BadComponent() {
        usePresenceActions();
        return null;
      }

      act(() => {
        create(
          <ErrorBoundary>
            <BadComponent />
          </ErrorBoundary>,
        );
      });

      expect(capturedError).not.toBeNull();
      expect(capturedError!.message).toContain("usePresenceActions must be used within PresenceProvider");
      spy.mockRestore();
    });
  });

  // ---- Provider initial state ----

  it("provides an empty presences map on mount", () => {
    const { result } = renderHookInProvider(usePresenceState);
    expect(result.current.presences).toBeInstanceOf(Map);
    expect(result.current.presences.size).toBe(0);
  });

  // ---- Gateway event: open (READY seed) ----

  it("seeds presences from the READY payload via the open event", () => {
    const { result } = renderHookInProvider(usePresenceState);

    act(() => {
      gatewayHandlers["open"]!({
        presences: [
          { user_id: "u1", status: "online" },
          { user_id: "u2", status: "idle" },
        ],
      });
    });

    expect(result.current.presences.size).toBe(2);
    expect(result.current.presences.get("u1")).toBe("online");
    expect(result.current.presences.get("u2")).toBe("idle");
  });

  it("ignores open event with invalid data", () => {
    const { result } = renderHookInProvider(usePresenceState);

    act(() => {
      gatewayHandlers["open"]!({ something: "else" });
    });

    expect(result.current.presences.size).toBe(0);
  });

  // ---- Gateway event: PRESENCE_UPDATE ----

  it("updates a single presence on PRESENCE_UPDATE", () => {
    const { result } = renderHookInProvider(usePresenceState);

    // Seed initial presences.
    act(() => {
      gatewayHandlers["open"]!({
        presences: [{ user_id: "u1", status: "online" }],
      });
    });

    // Update presence.
    act(() => {
      gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u1", status: "dnd" });
    });

    expect(result.current.presences.get("u1")).toBe("dnd");
  });

  it("adds a new presence entry on PRESENCE_UPDATE for an unknown user", () => {
    const { result } = renderHookInProvider(usePresenceState);

    act(() => {
      gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u99", status: "online" });
    });

    expect(result.current.presences.get("u99")).toBe("online");
  });

  it("ignores PRESENCE_UPDATE with invalid data", () => {
    const { result } = renderHookInProvider(usePresenceState);

    act(() => {
      gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: 123, status: "online" });
    });

    expect(result.current.presences.size).toBe(0);
  });

  it("ignores PRESENCE_UPDATE with missing fields", () => {
    const { result } = renderHookInProvider(usePresenceState);

    act(() => {
      gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u1" });
    });

    expect(result.current.presences.size).toBe(0);
  });

  // ---- Actions: updatePresence ----

  it("exposes updatePresence which mutates the presences map", () => {
    const stateResult = { current: undefined as unknown as ReturnType<typeof usePresenceState> };
    const actionsResult = { current: undefined as unknown as ReturnType<typeof usePresenceActions> };

    function HookCapture() {
      stateResult.current = usePresenceState();
      actionsResult.current = usePresenceActions();
      return null;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <PresenceProvider>
          <HookCapture />
        </PresenceProvider>,
      );
    });
    renderers.push(renderer);

    act(() => {
      actionsResult.current.updatePresence("u1", "online");
    });

    expect(stateResult.current.presences.get("u1")).toBe("online");
  });

  // ---- Actions: getPresence ----

  it("returns 'offline' for unknown users via getPresence", () => {
    const { result } = renderHookInProvider(usePresenceActions);

    expect(result.current.getPresence("unknown-user")).toBe("offline");
  });

  it("returns the current status via getPresence after an update", () => {
    const actionsResult = { current: undefined as unknown as ReturnType<typeof usePresenceActions> };

    function HookCapture() {
      actionsResult.current = usePresenceActions();
      return null;
    }

    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <PresenceProvider>
          <HookCapture />
        </PresenceProvider>,
      );
    });
    renderers.push(renderer);

    // Seed via open event.
    act(() => {
      gatewayHandlers["open"]!({
        presences: [{ user_id: "u1", status: "idle" }],
      });
    });

    // getPresence reads from the ref, which should reflect the latest state.
    expect(actionsResult.current.getPresence("u1")).toBe("idle");
  });
});
