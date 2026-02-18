import { useAuthGate, useNeedsServerSetup } from "@/hooks/use-auth-gate";
import type { AuthGateStatus } from "@/hooks/use-auth-gate";
import { renderHook } from "@/lib/__tests__/test-utils";

jest.mock("@/lib/auth/auth-context", () => ({
  useAuthState: jest.fn(),
}));

import { useAuthState } from "@/lib/auth/auth-context";

const mockUseAuthState = useAuthState as jest.MockedFunction<typeof useAuthState>;

// ---------------------------------------------------------------------------
// useAuthGate
// ---------------------------------------------------------------------------

describe("useAuthGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "loading" when tokens have not loaded', () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: false,
      servers: [],
      currentServerId: null,
      users: {},
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useAuthGate());
    expect(result.current.status).toBe("loading" satisfies AuthGateStatus);
    expect(result.current.currentServerId).toBeNull();
  });

  it('returns "loading" when servers array is empty', () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: true,
      servers: [],
      currentServerId: null,
      users: {},
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useAuthGate());
    expect(result.current.status).toBe("loading");
  });

  it('returns "loading" when currentServerId is null', () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: true,
      servers: [{ id: "s1", baseUrl: "http://localhost" }],
      currentServerId: null,
      users: {},
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useAuthGate());
    expect(result.current.status).toBe("loading");
  });

  it('returns "authenticated" when there is a current user', () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: true,
      servers: [{ id: "s1", baseUrl: "http://localhost" }],
      currentServerId: "s1",
      users: { s1: { id: "u1", username: "alice" } },
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useAuthGate());
    expect(result.current.status).toBe("authenticated");
    expect(result.current.currentServerId).toBe("s1");
  });

  it('returns "unauthenticated" when tokens are loaded but no user for current server', () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: true,
      servers: [{ id: "s1", baseUrl: "http://localhost" }],
      currentServerId: "s1",
      users: {},
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useAuthGate());
    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.currentServerId).toBe("s1");
  });

  it('returns "unauthenticated" when user exists for a different server', () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: true,
      servers: [
        { id: "s1", baseUrl: "http://localhost" },
        { id: "s2", baseUrl: "http://other" },
      ],
      currentServerId: "s1",
      users: { s2: { id: "u2", username: "bob" } },
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useAuthGate());
    expect(result.current.status).toBe("unauthenticated");
  });
});

// ---------------------------------------------------------------------------
// useNeedsServerSetup
// ---------------------------------------------------------------------------

describe("useNeedsServerSetup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns false when tokens have not loaded", () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: false,
      servers: [],
      currentServerId: null,
      users: {},
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useNeedsServerSetup());
    expect(result.current).toBe(false);
  });

  it("returns true when tokens loaded but no servers", () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: true,
      servers: [],
      currentServerId: null,
      users: {},
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useNeedsServerSetup());
    expect(result.current).toBe(true);
  });

  it("returns true when tokens loaded but no currentServerId", () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: true,
      servers: [{ id: "s1", baseUrl: "http://localhost" }],
      currentServerId: null,
      users: {},
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useNeedsServerSetup());
    expect(result.current).toBe(true);
  });

  it("returns false when tokens loaded and a server is selected", () => {
    mockUseAuthState.mockReturnValue({
      tokensLoaded: true,
      servers: [{ id: "s1", baseUrl: "http://localhost" }],
      currentServerId: "s1",
      users: {},
      mfaTickets: {},
    } as unknown as ReturnType<typeof useAuthState>);

    const { result } = renderHook(() => useNeedsServerSetup());
    expect(result.current).toBe(false);
  });
});
