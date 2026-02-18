/**
 * Shared test utilities for hook testing without @testing-library/react-hooks.
 * Uses react-test-renderer directly.
 */

import { createElement } from "react";
import renderer, { act } from "react-test-renderer";

/**
 * Minimal hook runner — renders a component that calls the hook and captures
 * the return value.
 */
export function renderHook<T>(hookFn: () => T): { result: { current: T }; unmount: () => void } {
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
