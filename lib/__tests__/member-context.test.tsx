import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const gatewayHandlers: Record<string, (data: unknown) => void> = {};

jest.mock("@/lib/gateway/gateway-context", () => ({
  useGateway: jest.fn(() => null),
  useGatewayEvent: jest.fn((event: string, handler: (data: unknown) => void) => {
    gatewayHandlers[event] = handler;
  }),
}));

import { MemberProvider, useMemberState, useMemberActions } from "@/lib/members/member-context";

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
// Test helper
// ---------------------------------------------------------------------------

const renderers: ReactTestRenderer[] = [];

function renderHookInProvider<T>(useHook: () => T): { result: { current: T } } {
  const result = { current: undefined as T };

  function HookCapture() {
    result.current = useHook();
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MemberProvider", () => {
  beforeEach(() => {
    capturedError = null;
    for (const key of Object.keys(gatewayHandlers)) {
      delete gatewayHandlers[key];
    }
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

  describe("useMemberState", () => {
    it("throws when used outside MemberProvider", () => {
      const spy = jest.spyOn(console, "error").mockImplementation();

      function BadComponent() {
        useMemberState();
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
      expect(capturedError!.message).toContain("useMemberState must be used within MemberProvider");
      spy.mockRestore();
    });
  });

  describe("useMemberActions", () => {
    it("throws when used outside MemberProvider", () => {
      const spy = jest.spyOn(console, "error").mockImplementation();

      function BadComponent() {
        useMemberActions();
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
      expect(capturedError!.message).toContain("useMemberActions must be used within MemberProvider");
      spy.mockRestore();
    });
  });

  // ---- Provider initial state ----

  it("provides empty members and roles on mount", () => {
    const { result } = renderHookInProvider(useMemberState);
    expect(result.current.members).toEqual([]);
    expect(result.current.roles).toEqual([]);
  });

  // ---- Gateway event: open (READY seed) ----

  it("seeds members and roles from the READY payload via the open event", () => {
    const { result } = renderHookInProvider(useMemberState);

    const m1 = makeMember("u1");
    const r1 = makeRole("r1", "Admin", 1);

    act(() => {
      gatewayHandlers["open"]!({
        members: [m1],
        roles: [r1],
      });
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0]!.user.id).toBe("u1");
    expect(result.current.roles).toHaveLength(1);
    expect(result.current.roles[0]!.id).toBe("r1");
  });

  it("ignores open event with invalid data", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["open"]!({ unrelated: "data" });
    });

    expect(result.current.members).toEqual([]);
    expect(result.current.roles).toEqual([]);
  });

  // ---- Gateway event: MEMBER_ADD ----

  it("adds a member on MEMBER_ADD", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["MEMBER_ADD"]!(makeMember("u1"));
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0]!.user.id).toBe("u1");
  });

  it("does not duplicate a member on MEMBER_ADD if already present", () => {
    const { result } = renderHookInProvider(useMemberState);

    const member = makeMember("u1");
    act(() => {
      gatewayHandlers["MEMBER_ADD"]!(member);
    });
    act(() => {
      gatewayHandlers["MEMBER_ADD"]!(member);
    });

    expect(result.current.members).toHaveLength(1);
  });

  it("ignores MEMBER_ADD with invalid data", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["MEMBER_ADD"]!({ name: "not a member" });
    });

    expect(result.current.members).toHaveLength(0);
  });

  // ---- Gateway event: MEMBER_UPDATE ----

  it("updates an existing member on MEMBER_UPDATE", () => {
    const { result } = renderHookInProvider(useMemberState);

    const member = makeMember("u1");
    act(() => {
      gatewayHandlers["MEMBER_ADD"]!(member);
    });

    const updated = { ...member, roles: ["r1"] };
    act(() => {
      gatewayHandlers["MEMBER_UPDATE"]!(updated);
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0]!.roles).toEqual(["r1"]);
  });

  it("ignores MEMBER_UPDATE with invalid data", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["MEMBER_UPDATE"]!({ something: "invalid" });
    });

    expect(result.current.members).toHaveLength(0);
  });

  // ---- Gateway event: MEMBER_REMOVE ----

  it("removes a member on MEMBER_REMOVE", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["MEMBER_ADD"]!(makeMember("u1"));
      gatewayHandlers["MEMBER_ADD"]!(makeMember("u2"));
    });

    act(() => {
      gatewayHandlers["MEMBER_REMOVE"]!({ user_id: "u1" });
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0]!.user.id).toBe("u2");
  });

  it("ignores MEMBER_REMOVE with invalid data", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["MEMBER_ADD"]!(makeMember("u1"));
    });
    act(() => {
      gatewayHandlers["MEMBER_REMOVE"]!({ id: "u1" }); // wrong shape — should be user_id
    });

    expect(result.current.members).toHaveLength(1);
  });

  // ---- Gateway event: ROLE_CREATE ----

  it("adds a role on ROLE_CREATE", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["ROLE_CREATE"]!(makeRole("r1", "Admin", 1));
    });

    expect(result.current.roles).toHaveLength(1);
    expect(result.current.roles[0]!.name).toBe("Admin");
  });

  it("does not duplicate a role on ROLE_CREATE if already present", () => {
    const { result } = renderHookInProvider(useMemberState);

    const role = makeRole("r1", "Admin", 1);
    act(() => {
      gatewayHandlers["ROLE_CREATE"]!(role);
    });
    act(() => {
      gatewayHandlers["ROLE_CREATE"]!(role);
    });

    expect(result.current.roles).toHaveLength(1);
  });

  it("ignores ROLE_CREATE with invalid data", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["ROLE_CREATE"]!({ colour: 0 }); // missing id, name, position
    });

    expect(result.current.roles).toHaveLength(0);
  });

  // ---- Gateway event: ROLE_UPDATE ----

  it("updates an existing role on ROLE_UPDATE", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["ROLE_CREATE"]!(makeRole("r1", "Admin", 1));
    });

    act(() => {
      gatewayHandlers["ROLE_UPDATE"]!(makeRole("r1", "Super Admin", 2));
    });

    expect(result.current.roles).toHaveLength(1);
    expect(result.current.roles[0]!.name).toBe("Super Admin");
    expect(result.current.roles[0]!.position).toBe(2);
  });

  it("ignores ROLE_UPDATE with invalid data", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["ROLE_UPDATE"]!({ colour: 0 });
    });

    expect(result.current.roles).toHaveLength(0);
  });

  // ---- Gateway event: ROLE_DELETE ----

  it("removes a role on ROLE_DELETE", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["ROLE_CREATE"]!(makeRole("r1", "Admin", 1));
      gatewayHandlers["ROLE_CREATE"]!(makeRole("r2", "Member", 0));
    });

    act(() => {
      gatewayHandlers["ROLE_DELETE"]!({ id: "r1" });
    });

    expect(result.current.roles).toHaveLength(1);
    expect(result.current.roles[0]!.id).toBe("r2");
  });

  it("ignores ROLE_DELETE with invalid data", () => {
    const { result } = renderHookInProvider(useMemberState);

    act(() => {
      gatewayHandlers["ROLE_CREATE"]!(makeRole("r1", "Admin", 1));
    });
    act(() => {
      gatewayHandlers["ROLE_DELETE"]!({ name: "r1" }); // wrong shape — should have id
    });

    expect(result.current.roles).toHaveLength(1);
  });

  // ---- Actions: getMember ----

  it("returns a member by userId via getMember", () => {
    const actionsResult = { current: undefined as unknown as ReturnType<typeof useMemberActions> };

    function HookCapture() {
      actionsResult.current = useMemberActions();
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

    act(() => {
      gatewayHandlers["MEMBER_ADD"]!(makeMember("u1"));
    });

    // getMember reads from a ref, so it should return the latest member.
    const member = actionsResult.current.getMember("u1");
    expect(member).toBeDefined();
    expect(member!.user.id).toBe("u1");
  });

  it("returns undefined for an unknown userId via getMember", () => {
    const { result } = renderHookInProvider(useMemberActions);

    expect(result.current.getMember("non-existent")).toBeUndefined();
  });
});
