/**
 * Tests for the web useColorScheme hook.
 * The web variant handles SSR hydration: returns "light" before hydration,
 * then switches to the actual system scheme after mount.
 */

jest.mock("react-native", () => {
  return {
    __esModule: true,
    Platform: { OS: "web", select: (obj: Record<string, unknown>) => obj.web ?? obj.default },
    StyleSheet: { create: (styles: unknown) => styles },
    useColorScheme: jest.fn(),
  };
});

import { createElement, useState, useEffect } from "react";
import renderer, { act } from "react-test-renderer";
import { useColorScheme as rnUseColorScheme } from "react-native";

// Import the web variant directly (not through the platform resolution).
import { useColorScheme } from "@/hooks/use-color-scheme.web";

const mockRNColorScheme = rnUseColorScheme as jest.MockedFunction<typeof rnUseColorScheme>;

function renderHook<T>(hookFn: () => T): {
  result: { current: T };
  unmount: () => void;
} {
  const result: { current: T } = {} as { current: T };
  function TestComponent() {
    result.current = hookFn();
    return null;
  }
  let root: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(createElement(TestComponent));
  });
  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe("useColorScheme (web)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 'light' before hydration completes", () => {
    mockRNColorScheme.mockReturnValue("dark");

    // The initial render should return "light" regardless of system scheme.
    const result: { current: "light" | "dark" } = {} as { current: "light" | "dark" };
    let hasRenderedInitial = false;

    function TestComponent() {
      const scheme = useColorScheme();
      if (!hasRenderedInitial) {
        hasRenderedInitial = true;
        result.current = scheme;
      }
      return null;
    }

    act(() => {
      renderer.create(createElement(TestComponent));
    });

    // The very first render should have returned "light" for SSR safety.
    expect(result.current).toBe("light");
  });

  it("returns system scheme after hydration", () => {
    mockRNColorScheme.mockReturnValue("dark");
    const { result } = renderHook(() => useColorScheme());

    // After the useEffect fires (via act), the hook should return the actual system scheme.
    expect(result.current).toBe("dark");
  });

  it("returns 'dark' as fallback when system scheme is null after hydration", () => {
    mockRNColorScheme.mockReturnValue(null);
    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("dark");
  });

  it("returns 'light' when system scheme is light after hydration", () => {
    mockRNColorScheme.mockReturnValue("light");
    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe("light");
  });
});
