"use client";

import type { Member } from "@uncord-chat/protocol/models/member";
import type { Role } from "@uncord-chat/protocol/models/role";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { useGatewayEvent } from "@/lib/gateway/gateway-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberStateCtx = {
  members: Member[];
  roles: Role[];
};

type MemberActionsCtx = {
  getMember: (userId: string) => Member | undefined;
};

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isReadyDataWithMembers(d: unknown): d is { members: Member[]; roles: Role[] } {
  return (
    typeof d === "object" &&
    d !== null &&
    "members" in d &&
    Array.isArray((d as { members: unknown }).members) &&
    "roles" in d &&
    Array.isArray((d as { roles: unknown }).roles)
  );
}

function isMember(d: unknown): d is Member {
  return typeof d === "object" && d !== null && "user" in d && "joined_at" in d;
}

function isMemberRemoveData(d: unknown): d is { user_id: string } {
  return (
    typeof d === "object" && d !== null && "user_id" in d && typeof (d as { user_id: unknown }).user_id === "string"
  );
}

function isRole(d: unknown): d is Role {
  return typeof d === "object" && d !== null && "id" in d && "name" in d && "position" in d;
}

function isRoleDeleteData(d: unknown): d is { id: string } {
  return typeof d === "object" && d !== null && "id" in d && typeof (d as { id: unknown }).id === "string";
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const MemberStateContext = createContext<MemberStateCtx | null>(null);
const MemberActionsContext = createContext<MemberActionsCtx | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function MemberProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const membersRef = useRef(members);
  membersRef.current = members;

  // Seed from READY payload.
  useGatewayEvent("open", (data) => {
    if (!isReadyDataWithMembers(data)) return;
    setMembers(data.members);
    setRoles(data.roles);
  });

  // Member events.
  useGatewayEvent("MEMBER_ADD", (data) => {
    if (!isMember(data)) return;
    setMembers((prev) => {
      if (prev.some((m) => m.user.id === data.user.id)) return prev;
      return [...prev, data];
    });
  });

  useGatewayEvent("MEMBER_UPDATE", (data) => {
    if (!isMember(data)) return;
    setMembers((prev) => prev.map((m) => (m.user.id === data.user.id ? data : m)));
  });

  useGatewayEvent("MEMBER_REMOVE", (data) => {
    if (!isMemberRemoveData(data)) return;
    setMembers((prev) => prev.filter((m) => m.user.id !== data.user_id));
  });

  // Role events.
  useGatewayEvent("ROLE_CREATE", (data) => {
    if (!isRole(data)) return;
    setRoles((prev) => {
      if (prev.some((r) => r.id === data.id)) return prev;
      return [...prev, data];
    });
  });

  useGatewayEvent("ROLE_UPDATE", (data) => {
    if (!isRole(data)) return;
    setRoles((prev) => prev.map((r) => (r.id === data.id ? data : r)));
  });

  useGatewayEvent("ROLE_DELETE", (data) => {
    if (!isRoleDeleteData(data)) return;
    setRoles((prev) => prev.filter((r) => r.id !== data.id));
  });

  const getMember = useCallback((userId: string): Member | undefined => {
    return membersRef.current.find((m) => m.user.id === userId);
  }, []);

  const state = useMemo<MemberStateCtx>(() => ({ members, roles }), [members, roles]);
  const actions = useMemo<MemberActionsCtx>(() => ({ getMember }), [getMember]);

  return (
    <MemberStateContext.Provider value={state}>
      <MemberActionsContext.Provider value={actions}>{children}</MemberActionsContext.Provider>
    </MemberStateContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useMemberState(): MemberStateCtx {
  const ctx = useContext(MemberStateContext);
  if (!ctx) throw new Error("useMemberState must be used within MemberProvider");
  return ctx;
}

export function useMemberActions(): MemberActionsCtx {
  const ctx = useContext(MemberActionsContext);
  if (!ctx) throw new Error("useMemberActions must be used within MemberProvider");
  return ctx;
}
