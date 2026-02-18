import { useThemeColor } from "@/hooks/use-theme-color";
import { Colors } from "@/constants/theme";
import { renderHook } from "@/lib/__tests__/test-utils";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(),
}));

import { useColorScheme } from "@/hooks/use-color-scheme";

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe("useThemeColor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("dark mode", () => {
    beforeEach(() => {
      mockUseColorScheme.mockReturnValue("dark");
    });

    it("returns the dark theme colour when no props override is given", () => {
      const { result } = renderHook(() => useThemeColor({}, "text"));
      expect(result.current).toBe(Colors.dark.text);
    });

    it("returns the dark prop override when provided", () => {
      const { result } = renderHook(() => useThemeColor({ dark: "#ff0000" }, "text"));
      expect(result.current).toBe("#ff0000");
    });

    it("ignores the light prop override in dark mode", () => {
      const { result } = renderHook(() => useThemeColor({ light: "#00ff00" }, "text"));
      expect(result.current).toBe(Colors.dark.text);
    });

    it("returns dark prop when both light and dark overrides are given", () => {
      const { result } = renderHook(() => useThemeColor({ light: "#00ff00", dark: "#ff0000" }, "text"));
      expect(result.current).toBe("#ff0000");
    });

    it("returns the correct colour for different colour names", () => {
      const { result } = renderHook(() => useThemeColor({}, "background"));
      expect(result.current).toBe(Colors.dark.background);
    });
  });

  describe("light mode", () => {
    beforeEach(() => {
      mockUseColorScheme.mockReturnValue("light");
    });

    it("returns the light theme colour when no props override is given", () => {
      const { result } = renderHook(() => useThemeColor({}, "text"));
      expect(result.current).toBe(Colors.light.text);
    });

    it("returns the light prop override when provided", () => {
      const { result } = renderHook(() => useThemeColor({ light: "#00ff00" }, "text"));
      expect(result.current).toBe("#00ff00");
    });

    it("ignores the dark prop override in light mode", () => {
      const { result } = renderHook(() => useThemeColor({ dark: "#ff0000" }, "text"));
      expect(result.current).toBe(Colors.light.text);
    });
  });

  // useColorScheme() now guarantees "light" | "dark" — no null case to test.
});
