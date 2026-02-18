/**
 * Tests for the native useColorScheme hook.
 * The hook always returns "light" | "dark" — never null.
 * The web variant (use-color-scheme.web.ts) handles SSR hydration.
 */

jest.mock("react-native", () => {
  return {
    __esModule: true,
    Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj.ios ?? obj.default },
    StyleSheet: { create: (styles: unknown) => styles },
    useColorScheme: jest.fn(),
  };
});

import { useColorScheme as rnUseColorScheme } from "react-native";
import { renderHook } from "@/lib/__tests__/test-utils";
import { useColorScheme } from "@/hooks/use-color-scheme";

const mockRNColorScheme = rnUseColorScheme as jest.MockedFunction<typeof rnUseColorScheme>;

describe("useColorScheme (native)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 'dark' when the system is in dark mode", () => {
    mockRNColorScheme.mockReturnValue("dark");
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe("dark");
  });

  it("returns 'light' when the system is in light mode", () => {
    mockRNColorScheme.mockReturnValue("light");
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe("light");
  });

  it("falls back to 'dark' when the colour scheme is not determined", () => {
    mockRNColorScheme.mockReturnValue(null);
    const { result } = renderHook(() => useColorScheme());
    expect(result.current).toBe("dark");
  });
});
