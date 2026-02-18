import { renderHook } from "@/lib/__tests__/test-utils";

jest.mock("expo-router", () => ({
  useSegments: jest.fn(),
}));

import { useSegments } from "expo-router";
import { useCurrentRoute } from "@/hooks/use-current-route";
import type { MainRoute } from "@/hooks/use-current-route";

const mockUseSegments = useSegments as jest.MockedFunction<typeof useSegments>;

describe("useCurrentRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns "settings" for the settings route', () => {
    mockUseSegments.mockReturnValue(["(main)", "settings"] as never);
    const { result } = renderHook(() => useCurrentRoute());
    expect(result.current).toBe("settings" satisfies MainRoute);
  });

  it('returns "channel" for a channel route', () => {
    mockUseSegments.mockReturnValue(["(main)", "channels", "abc-123"] as never);
    const { result } = renderHook(() => useCurrentRoute());
    expect(result.current).toBe("channel" satisfies MainRoute);
  });

  it('returns "index" for the main index route', () => {
    mockUseSegments.mockReturnValue(["(main)"] as never);
    const { result } = renderHook(() => useCurrentRoute());
    expect(result.current).toBe("index" satisfies MainRoute);
  });

  it('returns "unknown" for unrecognised routes', () => {
    mockUseSegments.mockReturnValue(["(main)", "something-else"] as never);
    const { result } = renderHook(() => useCurrentRoute());
    expect(result.current).toBe("unknown" satisfies MainRoute);
  });

  it('returns "index" when segments only contain the group', () => {
    mockUseSegments.mockReturnValue(["(main)"] as never);
    const { result } = renderHook(() => useCurrentRoute());
    expect(result.current).toBe("index");
  });

  it("does not false-positive on routes with 'channels' in other positions", () => {
    // If "channels" appears as the first segment (not second), segments[1]
    // is undefined so the hook correctly returns "index", not "channel".
    mockUseSegments.mockReturnValue(["channels"] as never);
    const { result } = renderHook(() => useCurrentRoute());
    expect(result.current).toBe("index");
  });
});
