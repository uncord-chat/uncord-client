import { DESKTOP_BREAKPOINT } from "@/constants/layout";
import { renderHook } from "@/lib/__tests__/test-utils";

// ---------------------------------------------------------------------------
// Mock useWindowDimensions at the module level without spreading react-native
// (spreading triggers native module initialisation which fails in tests).
// ---------------------------------------------------------------------------

let mockWidth = 1024;

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native/jest/mockComponent");
  return {
    __esModule: true,
    Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
    StyleSheet: { create: (styles: unknown) => styles },
    useWindowDimensions: () => ({
      width: mockWidth,
      height: 1024,
      scale: 1,
      fontScale: 1,
    }),
  };
});

import { useIsDesktop } from "@/hooks/use-is-desktop";

describe("useIsDesktop", () => {
  it("returns true when width equals the desktop breakpoint", () => {
    mockWidth = DESKTOP_BREAKPOINT;
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it("returns true when width exceeds the desktop breakpoint", () => {
    mockWidth = DESKTOP_BREAKPOINT + 200;
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it("returns false when width is one pixel below the desktop breakpoint", () => {
    mockWidth = DESKTOP_BREAKPOINT - 1;
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it("returns false for a typical mobile width (375px)", () => {
    mockWidth = 375;
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it("returns true for a wide desktop width (1920px)", () => {
    mockWidth = 1920;
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it("uses the DESKTOP_BREAKPOINT constant (768)", () => {
    expect(DESKTOP_BREAKPOINT).toBe(768);
  });
});
