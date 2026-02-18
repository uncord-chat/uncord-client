import { createElement } from "react";
import renderer, { act } from "react-test-renderer";
import type { Message } from "@uncord-chat/protocol/models/message";

// ---------------------------------------------------------------------------
// Mocks — capture the latest gateway event handler per event name.
// The real useGatewayEvent uses a ref so only the latest callback fires;
// we replicate that by storing only the most recent handler per event.
// ---------------------------------------------------------------------------

const gatewayHandlers: Record<string, (data: unknown) => void> = {};

jest.mock("@/lib/gateway/gateway-context", () => ({
  useGatewayEvent: (event: string, handler: (data: unknown) => void) => {
    gatewayHandlers[event] = handler;
  },
}));

import { useGatewayMessages } from "@/lib/gateway/use-gateway-messages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emit(event: string, data: unknown) {
  const handler = gatewayHandlers[event];
  if (handler) handler(data);
}

function makeMessage(overrides: Partial<Message> & { id: string; channel_id: string }): Message {
  return {
    content: "hello",
    author: { id: "u1", username: "alice" },
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  } as Message;
}

function renderHook(
  channelId: string | null,
  setMessages: (updater: (prev: Message[]) => Message[]) => void,
): {
  rerender: (channelId: string | null) => void;
  unmount: () => void;
} {
  function TestComponent({ cId }: { cId: string | null }) {
    useGatewayMessages(cId, setMessages);
    return null;
  }

  let root: renderer.ReactTestRenderer;
  act(() => {
    root = renderer.create(createElement(TestComponent, { cId: channelId }));
  });

  return {
    rerender: (newChannelId: string | null) => {
      act(() => {
        root.update(createElement(TestComponent, { cId: newChannelId }));
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

describe("useGatewayMessages", () => {
  let setMessages: jest.Mock;
  let capturedUpdaters: Array<(prev: Message[]) => Message[]>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear captured handlers between tests.
    for (const key of Object.keys(gatewayHandlers)) {
      delete gatewayHandlers[key];
    }

    capturedUpdaters = [];
    setMessages = jest.fn((updater: (prev: Message[]) => Message[]) => {
      capturedUpdaters.push(updater);
    });
  });

  // -----------------------------------------------------------------------
  // MESSAGE_CREATE
  // -----------------------------------------------------------------------

  describe("MESSAGE_CREATE", () => {
    it("prepends a new message to the list", () => {
      renderHook("ch1", setMessages);

      const msg = makeMessage({ id: "m1", channel_id: "ch1" });
      act(() => {
        emit("MESSAGE_CREATE", msg);
      });

      expect(setMessages).toHaveBeenCalledTimes(1);
      const updater = capturedUpdaters[0];
      const result = updater([]);
      expect(result).toEqual([msg]);
    });

    it("deduplicates against messages already in the list", () => {
      renderHook("ch1", setMessages);

      const msg = makeMessage({ id: "m1", channel_id: "ch1" });
      act(() => {
        emit("MESSAGE_CREATE", msg);
      });

      const updater = capturedUpdaters[0];
      const existing = [makeMessage({ id: "m1", channel_id: "ch1", content: "optimistic" })];
      const result = updater(existing);

      // Should return unchanged list because id already exists.
      expect(result).toBe(existing);
    });

    it("ignores events for a different channel", () => {
      renderHook("ch1", setMessages);

      const msg = makeMessage({ id: "m1", channel_id: "ch2" });
      act(() => {
        emit("MESSAGE_CREATE", msg);
      });

      expect(setMessages).not.toHaveBeenCalled();
    });

    it("ignores events with invalid data shape", () => {
      renderHook("ch1", setMessages);

      act(() => {
        emit("MESSAGE_CREATE", { invalid: true });
        emit("MESSAGE_CREATE", null);
        emit("MESSAGE_CREATE", "string");
      });

      expect(setMessages).not.toHaveBeenCalled();
    });

    it("prepends to existing messages", () => {
      renderHook("ch1", setMessages);

      const newMsg = makeMessage({ id: "m2", channel_id: "ch1" });
      act(() => {
        emit("MESSAGE_CREATE", newMsg);
      });

      const updater = capturedUpdaters[0];
      const existing = [makeMessage({ id: "m1", channel_id: "ch1" })];
      const result = updater(existing);

      expect(result[0].id).toBe("m2");
      expect(result[1].id).toBe("m1");
    });
  });

  // -----------------------------------------------------------------------
  // MESSAGE_UPDATE
  // -----------------------------------------------------------------------

  describe("MESSAGE_UPDATE", () => {
    it("replaces the matching message in the list", () => {
      renderHook("ch1", setMessages);

      const updated = makeMessage({ id: "m1", channel_id: "ch1", content: "edited" });
      act(() => {
        emit("MESSAGE_UPDATE", updated);
      });

      expect(setMessages).toHaveBeenCalledTimes(1);
      const updater = capturedUpdaters[0];
      const existing = [
        makeMessage({ id: "m1", channel_id: "ch1", content: "original" }),
        makeMessage({ id: "m2", channel_id: "ch1", content: "other" }),
      ];
      const result = updater(existing);

      expect(result[0].content).toBe("edited");
      expect(result[1].content).toBe("other");
    });

    it("leaves the list unchanged if message id is not found", () => {
      renderHook("ch1", setMessages);

      const updated = makeMessage({ id: "m999", channel_id: "ch1", content: "edited" });
      act(() => {
        emit("MESSAGE_UPDATE", updated);
      });

      const updater = capturedUpdaters[0];
      const existing = [makeMessage({ id: "m1", channel_id: "ch1" })];
      const result = updater(existing);

      expect(result).toEqual(existing);
    });

    it("ignores events for a different channel", () => {
      renderHook("ch1", setMessages);

      act(() => {
        emit("MESSAGE_UPDATE", makeMessage({ id: "m1", channel_id: "ch2" }));
      });

      expect(setMessages).not.toHaveBeenCalled();
    });

    it("ignores invalid data shapes", () => {
      renderHook("ch1", setMessages);

      act(() => {
        emit("MESSAGE_UPDATE", { channel_id: "ch1" }); // missing id and content
      });

      expect(setMessages).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // MESSAGE_DELETE
  // -----------------------------------------------------------------------

  describe("MESSAGE_DELETE", () => {
    it("removes the matching message from the list", () => {
      renderHook("ch1", setMessages);

      act(() => {
        emit("MESSAGE_DELETE", { id: "m1", channel_id: "ch1" });
      });

      expect(setMessages).toHaveBeenCalledTimes(1);
      const updater = capturedUpdaters[0];
      const existing = [makeMessage({ id: "m1", channel_id: "ch1" }), makeMessage({ id: "m2", channel_id: "ch1" })];
      const result = updater(existing);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("m2");
    });

    it("returns unchanged list if message id is not found", () => {
      renderHook("ch1", setMessages);

      act(() => {
        emit("MESSAGE_DELETE", { id: "m999", channel_id: "ch1" });
      });

      const updater = capturedUpdaters[0];
      const existing = [makeMessage({ id: "m1", channel_id: "ch1" })];
      const result = updater(existing);

      expect(result).toHaveLength(1);
    });

    it("ignores events for a different channel", () => {
      renderHook("ch1", setMessages);

      act(() => {
        emit("MESSAGE_DELETE", { id: "m1", channel_id: "ch2" });
      });

      expect(setMessages).not.toHaveBeenCalled();
    });

    it("ignores invalid data shapes", () => {
      renderHook("ch1", setMessages);

      act(() => {
        emit("MESSAGE_DELETE", { no_id: true });
        emit("MESSAGE_DELETE", null);
      });

      expect(setMessages).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // channelId tracking
  // -----------------------------------------------------------------------

  describe("channelId reactivity", () => {
    it("tracks the latest channelId via ref", () => {
      const { rerender } = renderHook("ch1", setMessages);

      // Rerender with a new channelId.
      rerender("ch2");

      // Events for ch1 should now be ignored.
      act(() => {
        emit("MESSAGE_CREATE", makeMessage({ id: "m1", channel_id: "ch1" }));
      });
      expect(setMessages).not.toHaveBeenCalled();

      // Events for ch2 should be processed.
      act(() => {
        emit("MESSAGE_CREATE", makeMessage({ id: "m2", channel_id: "ch2" }));
      });
      expect(setMessages).toHaveBeenCalledTimes(1);
    });

    it("ignores all events when channelId is null", () => {
      renderHook(null, setMessages);

      act(() => {
        emit("MESSAGE_CREATE", makeMessage({ id: "m1", channel_id: "ch1" }));
        emit("MESSAGE_UPDATE", makeMessage({ id: "m1", channel_id: "ch1" }));
        emit("MESSAGE_DELETE", { id: "m1", channel_id: "ch1" });
      });

      expect(setMessages).not.toHaveBeenCalled();
    });
  });
});
