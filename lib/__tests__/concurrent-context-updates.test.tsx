/**
 * Tests that verify contexts handle rapid-fire concurrent gateway events
 * correctly without losing updates or corrupting state.
 */

import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing modules under test
// ---------------------------------------------------------------------------

const gatewayHandlers: Record<string, (data: unknown) => void> = {};

jest.mock("@/lib/gateway/gateway-context", () => ({
  useGateway: jest.fn(() => null),
  useGatewayEvent: jest.fn((event: string, handler: (data: unknown) => void) => {
    gatewayHandlers[event] = handler;
  }),
}));

import { MemberProvider, useMemberState } from "@/lib/members/member-context";
import { PresenceProvider, usePresenceState } from "@/lib/presence/presence-context";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const makeUser = (id: string, username = `user-${id}`) => ({
  id,
  username,
  display_name: username,
  email: `${username}@test.com`,
  created_at: "2025-01-01T00:00:00Z",
  email_verified: true,
  mfa_enabled: false,
});

const makeMember = (userId: string, roleIds: string[] = []) => ({
  user: makeUser(userId),
  role_ids: roleIds,
  joined_at: "2025-01-01T00:00:00Z",
});

const makeRole = (id: string, name: string, position: number) => ({
  id,
  name,
  position,
  colour: 0,
  permissions: "0",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderers: ReactTestRenderer[] = [];

function renderMemberHook(): { result: { current: ReturnType<typeof useMemberState> } } {
  const result = { current: undefined as unknown as ReturnType<typeof useMemberState> };

  function HookCapture() {
    result.current = useMemberState();
    return null;
  }

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <MemberProvider>
        <HookCapture />
      </MemberProvider>,
    );
  });
  renderers.push(renderer);
  return { result };
}

function renderPresenceHook(): { result: { current: ReturnType<typeof usePresenceState> } } {
  const result = { current: undefined as unknown as ReturnType<typeof usePresenceState> };

  function HookCapture() {
    result.current = usePresenceState();
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

describe("Concurrent context updates", () => {
  beforeEach(() => {
    for (const key of Object.keys(gatewayHandlers)) {
      delete gatewayHandlers[key];
    }
  });

  afterEach(() => {
    for (const r of renderers) {
      act(() => r.unmount());
    }
    renderers.length = 0;
  });

  // ---- MemberProvider: rapid-fire events ----

  describe("MemberProvider rapid-fire events", () => {
    it("handles many MEMBER_ADD events in a single act batch", () => {
      const { result } = renderMemberHook();

      act(() => {
        for (let i = 0; i < 50; i++) {
          gatewayHandlers["MEMBER_ADD"]!(makeMember(`user-${i}`));
        }
      });

      expect(result.current.members).toHaveLength(50);
    });

    it("handles interleaved MEMBER_ADD and MEMBER_REMOVE events", () => {
      const { result } = renderMemberHook();

      act(() => {
        gatewayHandlers["MEMBER_ADD"]!(makeMember("u1"));
        gatewayHandlers["MEMBER_ADD"]!(makeMember("u2"));
        gatewayHandlers["MEMBER_ADD"]!(makeMember("u3"));
        gatewayHandlers["MEMBER_REMOVE"]!({ user_id: "u2" });
        gatewayHandlers["MEMBER_ADD"]!(makeMember("u4"));
        gatewayHandlers["MEMBER_REMOVE"]!({ user_id: "u1" });
      });

      const ids = result.current.members.map((m) => m.user.id).sort();
      expect(ids).toEqual(["u3", "u4"]);
    });

    it("handles MEMBER_ADD followed by immediate MEMBER_UPDATE for same user", () => {
      const { result } = renderMemberHook();

      const member = makeMember("u1", []);
      const updated = { ...member, roles: ["r1"] };

      act(() => {
        gatewayHandlers["MEMBER_ADD"]!(member);
        gatewayHandlers["MEMBER_UPDATE"]!(updated);
      });

      expect(result.current.members).toHaveLength(1);
      expect(result.current.members[0]!.roles).toEqual(["r1"]);
    });

    it("handles rapid ROLE_CREATE and ROLE_DELETE in one batch", () => {
      const { result } = renderMemberHook();

      act(() => {
        gatewayHandlers["ROLE_CREATE"]!(makeRole("r1", "Admin", 3));
        gatewayHandlers["ROLE_CREATE"]!(makeRole("r2", "Mod", 2));
        gatewayHandlers["ROLE_CREATE"]!(makeRole("r3", "Member", 1));
        gatewayHandlers["ROLE_DELETE"]!({ id: "r2" });
      });

      const roleIds = result.current.roles.map((r) => r.id).sort();
      expect(roleIds).toEqual(["r1", "r3"]);
    });

    it("handles MEMBER_REMOVE for a user that was never added", () => {
      const { result } = renderMemberHook();

      act(() => {
        gatewayHandlers["MEMBER_ADD"]!(makeMember("u1"));
        gatewayHandlers["MEMBER_REMOVE"]!({ user_id: "non-existent" });
      });

      expect(result.current.members).toHaveLength(1);
    });
  });

  // ---- PresenceProvider: rapid-fire events ----

  describe("PresenceProvider rapid-fire events", () => {
    it("handles many PRESENCE_UPDATE events in a single act batch", () => {
      const { result } = renderPresenceHook();

      act(() => {
        for (let i = 0; i < 50; i++) {
          gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: `user-${i}`, status: "online" });
        }
      });

      expect(result.current.presences.size).toBe(50);
    });

    it("handles rapid status changes for the same user", () => {
      const { result } = renderPresenceHook();

      act(() => {
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u1", status: "online" });
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u1", status: "idle" });
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u1", status: "dnd" });
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u1", status: "online" });
      });

      // Last update wins
      expect(result.current.presences.get("u1")).toBe("online");
    });

    it("handles mix of valid and invalid events without corruption", () => {
      const { result } = renderPresenceHook();

      act(() => {
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u1", status: "online" });
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: 123, status: "online" }); // invalid
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u2", status: "idle" });
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u3" }); // invalid: missing status
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u4", status: "dnd" });
      });

      expect(result.current.presences.size).toBe(3);
      expect(result.current.presences.get("u1")).toBe("online");
      expect(result.current.presences.get("u2")).toBe("idle");
      expect(result.current.presences.get("u4")).toBe("dnd");
    });

    it("handles READY seed followed by immediate updates", () => {
      const { result } = renderPresenceHook();

      act(() => {
        gatewayHandlers["open"]!({
          presences: [
            { user_id: "u1", status: "online" },
            { user_id: "u2", status: "idle" },
          ],
        });
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u1", status: "offline" });
        gatewayHandlers["PRESENCE_UPDATE"]!({ user_id: "u3", status: "online" });
      });

      expect(result.current.presences.get("u1")).toBe("offline");
      expect(result.current.presences.get("u2")).toBe("idle");
      expect(result.current.presences.get("u3")).toBe("online");
    });
  });
});
