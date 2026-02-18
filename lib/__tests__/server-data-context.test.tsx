import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test.
// ServerDataProvider depends on AuthProvider hooks and API client functions.
// ---------------------------------------------------------------------------

const mockUseAuthState = jest.fn((): Record<string, unknown> => ({ currentServerId: null }));
const mockUseCurrentServer = jest.fn((): Record<string, unknown> | null => null);
const mockUseAuthActions = jest.fn((): Record<string, unknown> => ({ refreshSession: jest.fn() }));

jest.mock("@/lib/auth/auth-context", () => ({
  useAuthState: () => mockUseAuthState(),
  useCurrentServer: () => mockUseCurrentServer(),
  useAuthActions: () => mockUseAuthActions(),
}));

jest.mock("@/lib/api/client", () => ({
  getChannels: jest.fn(),
  getCategories: jest.fn(),
  getServerConfig: jest.fn(),
}));

const mockFetchWithRefresh = jest.fn().mockResolvedValue({ ok: false, reason: "Not authenticated." });

jest.mock("@/lib/api/fetch-with-refresh", () => ({
  fetchWithRefresh: (...args: unknown[]) => mockFetchWithRefresh(...(args as [unknown, unknown, unknown, unknown])),
}));

import { ServerDataProvider, useServerDataState, useServerDataActions } from "@/lib/server-data/server-data-context";

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
// Test helpers
// ---------------------------------------------------------------------------

const renderers: ReactTestRenderer[] = [];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ServerDataProvider", () => {
  beforeEach(() => {
    capturedError = null;
    jest.clearAllMocks();
    mockUseAuthState.mockReturnValue({ currentServerId: null });
    mockUseCurrentServer.mockReturnValue(null);
    mockUseAuthActions.mockReturnValue({ refreshSession: jest.fn() });
    mockFetchWithRefresh.mockResolvedValue({ ok: false, reason: "Not authenticated." });
  });

  afterEach(() => {
    for (const r of renderers) {
      act(() => {
        r.unmount();
      });
    }
    renderers.length = 0;
  });

  // ---- Hook-outside-provider tests ----

  describe("useServerDataState", () => {
    it("throws when used outside ServerDataProvider", () => {
      const spy = jest.spyOn(console, "error").mockImplementation();

      function BadComponent() {
        useServerDataState();
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
      expect(capturedError!.message).toContain("useServerDataState must be used within ServerDataProvider");
      spy.mockRestore();
    });
  });

  describe("useServerDataActions", () => {
    it("throws when used outside ServerDataProvider", () => {
      const spy = jest.spyOn(console, "error").mockImplementation();

      function BadComponent() {
        useServerDataActions();
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
      expect(capturedError!.message).toContain("useServerDataActions must be used within ServerDataProvider");
      spy.mockRestore();
    });
  });

  // ---- Provider initial state ----

  it("provides empty initial state when no server is selected", async () => {
    const result = { current: undefined as unknown as ReturnType<typeof useServerDataState> };

    function HookCapture() {
      result.current = useServerDataState();
      return null;
    }

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ServerDataProvider>
          <HookCapture />
        </ServerDataProvider>,
      );
    });
    renderers.push(renderer);

    expect(result.current.channels).toEqual([]);
    expect(result.current.categories).toEqual([]);
    expect(result.current.serverConfig).toBeNull();
    expect(result.current.currentChannelId).toBeNull();
    expect(result.current.channelsError).toBeNull();
  });

  // ---- Actions: setCurrentChannel ----

  it("updates currentChannelId via setCurrentChannel", async () => {
    const stateResult = { current: undefined as unknown as ReturnType<typeof useServerDataState> };
    const actionsResult = { current: undefined as unknown as ReturnType<typeof useServerDataActions> };

    function HookCapture() {
      stateResult.current = useServerDataState();
      actionsResult.current = useServerDataActions();
      return null;
    }

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ServerDataProvider>
          <HookCapture />
        </ServerDataProvider>,
      );
    });
    renderers.push(renderer);

    expect(stateResult.current.currentChannelId).toBeNull();

    act(() => {
      actionsResult.current.setCurrentChannel("ch-1");
    });

    expect(stateResult.current.currentChannelId).toBe("ch-1");

    act(() => {
      actionsResult.current.setCurrentChannel(null);
    });

    expect(stateResult.current.currentChannelId).toBeNull();
  });

  // ---- Fetches data when a server is selected ----

  it("fetches channels, categories, and config when a server is selected", async () => {
    mockUseAuthState.mockReturnValue({ currentServerId: "srv-1" });
    mockUseCurrentServer.mockReturnValue({ id: "srv-1", baseUrl: "http://localhost:8080", name: "Test" });
    mockUseAuthActions.mockReturnValue({ refreshSession: jest.fn() });

    const mockChannels = [{ id: "ch-1", name: "general", type: "text" }];
    const mockCategories = [{ id: "cat-1", name: "Text Channels", position: 0 }];
    const mockConfig = { name: "Test Server", open_join: false };

    mockFetchWithRefresh
      .mockResolvedValueOnce({ ok: true, data: mockConfig }) // getServerConfig
      .mockResolvedValueOnce({ ok: true, data: mockChannels }) // getChannels
      .mockResolvedValueOnce({ ok: true, data: mockCategories }); // getCategories

    const stateResult = { current: undefined as unknown as ReturnType<typeof useServerDataState> };

    function HookCapture() {
      stateResult.current = useServerDataState();
      return null;
    }

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ServerDataProvider>
          <HookCapture />
        </ServerDataProvider>,
      );
    });
    renderers.push(renderer);

    expect(stateResult.current.channels).toEqual(mockChannels);
    expect(stateResult.current.categories).toEqual(mockCategories);
    expect(stateResult.current.serverConfig).toEqual(mockConfig);
    expect(stateResult.current.channelsLoading).toBe(false);
  });

  // ---- Handles fetch failures ----

  it("sets channelsError when all fetches fail", async () => {
    mockUseAuthState.mockReturnValue({ currentServerId: "srv-1" });
    mockUseCurrentServer.mockReturnValue({ id: "srv-1", baseUrl: "http://localhost:8080", name: "Test" });
    mockUseAuthActions.mockReturnValue({ refreshSession: jest.fn() });

    mockFetchWithRefresh.mockResolvedValue({ ok: false, reason: "Server unreachable" });

    const stateResult = { current: undefined as unknown as ReturnType<typeof useServerDataState> };

    function HookCapture() {
      stateResult.current = useServerDataState();
      return null;
    }

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ServerDataProvider>
          <HookCapture />
        </ServerDataProvider>,
      );
    });
    renderers.push(renderer);

    expect(stateResult.current.channels).toEqual([]);
    expect(stateResult.current.categories).toEqual([]);
    expect(stateResult.current.serverConfig).toBeNull();
    expect(stateResult.current.channelsError).toBe("Server unreachable");
  });
});
