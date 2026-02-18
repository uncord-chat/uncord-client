/**
 * Low-level API client. All calls take a server baseUrl (no trailing slash).
 */

import { DEFAULT_TIMEOUT_MS } from "@/constants/config";
import type { ErrorCode } from "@uncord-chat/protocol/errors/codes";
import type {
  AuthResponse,
  DeleteAccountRequest,
  LoginRequest,
  MFAConfirmRequest,
  MFAConfirmResponse,
  MFADisableRequest,
  MFAEnableRequest,
  MFARegenerateCodesRequest,
  MFARegenerateCodesResponse,
  MFARequiredResponse,
  MFASetupResponse,
  MFAVerifyRequest,
  MessageResponse,
  RefreshRequest,
  RegisterRequest,
  VerifyEmailRequest,
  VerifyPasswordRequest,
} from "@uncord-chat/protocol/models/auth";
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from "@uncord-chat/protocol/models/category";
import type { Channel, CreateChannelRequest, UpdateChannelRequest } from "@uncord-chat/protocol/models/channel";
import type { AcceptOnboardingRequest } from "@uncord-chat/protocol/models/invite";
import type { Invite, CreateInviteRequest } from "@uncord-chat/protocol/models/invite";
import type { OnboardingConfig, OnboardingStatusResponse } from "@uncord-chat/protocol/models/onboarding";
import type {
  Ban,
  BanMemberRequest,
  Member,
  TimeoutMemberRequest,
  UpdateMemberRequest,
} from "@uncord-chat/protocol/models/member";
import type {
  Attachment,
  CreateMessageRequest,
  Message,
  UpdateMessageRequest,
} from "@uncord-chat/protocol/models/message";
import type { ResolvedPermissions, SetOverrideRequest } from "@uncord-chat/protocol/models/permission";
import type { CreateRoleRequest, Role, UpdateRoleRequest } from "@uncord-chat/protocol/models/role";
import type { SearchResponse } from "@uncord-chat/protocol/models/search";
import type { PublicServerInfo, ServerConfig, UpdateServerConfigRequest } from "@uncord-chat/protocol/models/server";
import type { UpdateUserRequest, User } from "@uncord-chat/protocol/models/user";

/** Success result from an API call. */
export type ApiSuccess<T> = { ok: true; data: T };

/** Error result from an API call. */
export type ApiError = {
  ok: false;
  code: string;
  message: string;
};

/** Result type for API calls. */
export type ApiResult<T> = ApiSuccess<T> | ApiError;

function isErrorPayload(body: unknown): body is { error: { code: string; message: string } } {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const err = (body as { error: unknown }).error;
  return typeof err === "object" && err !== null && "code" in err && "message" in err;
}

/** Validates that a string looks like a protocol error code (UPPER_SNAKE_CASE). */
function isValidErrorCode(code: string): boolean {
  return /^[A-Z][A-Z0-9_]+$/.test(code);
}

async function parseResponse<T>(res: Response): Promise<ApiResult<T>> {
  let body: unknown;
  try {
    body = (await res.json()) as unknown;
  } catch {
    return {
      ok: false,
      code: res.status === 429 ? "RATE_LIMITED" : "INTERNAL_ERROR",
      message: `Server returned ${res.status} ${res.statusText}`,
    };
  }
  if (isErrorPayload(body)) {
    const rawCode = typeof body.error.code === "string" ? body.error.code : "";
    const code = isValidErrorCode(rawCode) ? rawCode : "INTERNAL_ERROR";
    return {
      ok: false,
      code: code as ErrorCode,
      message: typeof body.error.message === "string" ? body.error.message : "Unknown error",
    };
  }
  if (typeof body === "object" && body !== null && "data" in body) {
    return { ok: true, data: (body as { data: T }).data };
  }
  return {
    ok: false,
    code: "INTERNAL_ERROR",
    message: "Invalid response format",
  };
}

/** Parse a response that has no data envelope (e.g. 204 No Content). */
async function parseEmptyResponse(res: Response): Promise<ApiResult<void>> {
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return { ok: true, data: undefined };
  }
  let body: unknown;
  try {
    body = (await res.json()) as unknown;
  } catch {
    if (!res.ok) {
      return {
        ok: false,
        code: res.status === 429 ? "RATE_LIMITED" : "INTERNAL_ERROR",
        message: `Server returned ${res.status} ${res.statusText}`,
      };
    }
    return { ok: true, data: undefined };
  }
  if (isErrorPayload(body)) {
    const rawCode = typeof body.error.code === "string" ? body.error.code : "";
    const code = isValidErrorCode(rawCode) ? rawCode : "INTERNAL_ERROR";
    return {
      ok: false,
      code: code as ErrorCode,
      message: typeof body.error.message === "string" ? body.error.message : "Unknown error",
    };
  }
  if (!res.ok) {
    return { ok: false, code: "INTERNAL_ERROR", message: `Server returned ${res.status} ${res.statusText}` };
  }
  return { ok: true, data: undefined };
}

function apiV1(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/api/v1`;
}

type Timeout = { signal: AbortSignal; clear: () => void };

/**
 * Create an AbortSignal that fires after `ms` milliseconds.
 * Callers can also pass an external signal to race against.
 * Returns the signal and a `clear` function — callers **must** call `clear()`
 * when the request completes (typically in a `finally` block) to avoid timer
 * leaks.
 */
function timeoutSignal(ms: number = DEFAULT_TIMEOUT_MS, external?: AbortSignal): Timeout {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timed out")), ms);

  function clear() {
    clearTimeout(timer);
  }

  // If an external signal is provided, abort when it fires.
  if (external) {
    if (external.aborted) {
      controller.abort(external.reason);
      clear();
    } else {
      external.addEventListener(
        "abort",
        () => {
          controller.abort(external.reason);
          clear();
        },
        { once: true },
      );
    }
  }

  // Also clean up the timer when the signal fires via its own abort.
  controller.signal.addEventListener("abort", clear, { once: true });

  return { signal: controller.signal, clear };
}

/** Options that can be passed to API helpers for cancellation. */
export type FetchOptions = {
  signal?: AbortSignal;
};

/** GET /api/v1/health. Use to validate a server before adding. */
export async function healthCheck(baseUrl: string, opts?: FetchOptions): Promise<ApiResult<{ status: string }>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS, opts?.signal);
  try {
    const res = await fetch(`${apiV1(baseUrl)}/health`, {
      method: "GET",
      signal: timeout.signal,
    });
    let body: unknown;
    try {
      body = (await res.json()) as unknown;
    } catch {
      return {
        ok: false,
        code: "INTERNAL_ERROR",
        message: `Server returned ${res.status} ${res.statusText}`,
      };
    }
    if (isErrorPayload(body)) {
      const rawCode = typeof body.error.code === "string" ? body.error.code : "";
      const code = isValidErrorCode(rawCode) ? rawCode : "INTERNAL_ERROR";
      return { ok: false, code: code as ErrorCode, message: typeof body.error.message === "string" ? body.error.message : "Unknown error" };
    }
    // Accept both envelope ({ data: { status } }) and flat ({ status }) responses.
    const payload = typeof body === "object" && body !== null && "data" in body
      ? (body as { data: unknown }).data
      : body;
    if (typeof payload === "object" && payload !== null && "status" in payload && typeof (payload as { status: unknown }).status === "string") {
      return { ok: true, data: payload as { status: string } };
    }
    return { ok: false, code: "INTERNAL_ERROR", message: "Health check failed" };
  } catch (e) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      message: e instanceof Error ? e.message : "Network error",
    };
  } finally {
    timeout.clear();
  }
}

// ---------------------------------------------------------------------------
// Unauthenticated helpers
// ---------------------------------------------------------------------------

/** Unauthenticated GET request. */
async function unauthGet<T>(baseUrl: string, path: string, opts?: FetchOptions): Promise<ApiResult<T>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS, opts?.signal);
  try {
    const res = await fetch(`${apiV1(baseUrl)}${path}`, {
      method: "GET",
      signal: timeout.signal,
    });
    return parseResponse<T>(res);
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    timeout.clear();
  }
}

/** Unauthenticated POST to /auth/* paths. */
async function post<T>(baseUrl: string, path: string, body: unknown, opts?: FetchOptions): Promise<ApiResult<T>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS, opts?.signal);
  try {
    const res = await fetch(`${apiV1(baseUrl)}/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: timeout.signal,
    });
    return parseResponse<T>(res);
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    timeout.clear();
  }
}

// ---------------------------------------------------------------------------
// Server (unauthenticated)
// ---------------------------------------------------------------------------

/** GET /api/v1/server/info — public server identity (name, description, icon). */
export async function getPublicServerInfo(baseUrl: string): Promise<ApiResult<PublicServerInfo>> {
  return unauthGet<PublicServerInfo>(baseUrl, "/server/info");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** POST /api/v1/auth/register. Returns 201 with AuthResponse. */
export async function register(baseUrl: string, body: RegisterRequest): Promise<ApiResult<AuthResponse>> {
  return post<AuthResponse>(baseUrl, "/register", body);
}

/** POST /api/v1/auth/login. Returns 200 with AuthResponse or MFARequiredResponse. */
export async function login(
  baseUrl: string,
  body: LoginRequest,
): Promise<ApiResult<AuthResponse | MFARequiredResponse>> {
  return post<AuthResponse | MFARequiredResponse>(baseUrl, "/login", body);
}

/** POST /api/v1/auth/refresh. Returns 200 with TokenPairResponse. */
export async function refresh(
  baseUrl: string,
  body: RefreshRequest,
): Promise<ApiResult<{ access_token: string; refresh_token: string }>> {
  return post<{ access_token: string; refresh_token: string }>(baseUrl, "/refresh", body);
}

/** POST /api/v1/auth/mfa/verify. Returns 200 with AuthResponse. */
export async function mfaVerify(baseUrl: string, body: MFAVerifyRequest): Promise<ApiResult<AuthResponse>> {
  return post<AuthResponse>(baseUrl, "/mfa/verify", body);
}

/** POST /api/v1/auth/verify-email. */
export async function verifyEmail(baseUrl: string, body: VerifyEmailRequest): Promise<ApiResult<MessageResponse>> {
  return post<MessageResponse>(baseUrl, "/verify-email", body);
}

/** POST /api/v1/auth/verify-password. Authenticated. */
export async function verifyPassword(
  baseUrl: string,
  accessToken: string,
  body: VerifyPasswordRequest,
): Promise<ApiResult<MessageResponse>> {
  return authFetch<MessageResponse>(baseUrl, accessToken, "POST", "/auth/verify-password", body);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** GET /api/v1/users/@me. Requires Bearer token. Use for restoring session. */
export async function getMe(baseUrl: string, accessToken: string): Promise<ApiResult<User>> {
  return authGet<User>(baseUrl, accessToken, "/users/@me");
}

/** PATCH /api/v1/users/@me — update the current user's profile. */
export async function updateMe(
  baseUrl: string,
  accessToken: string,
  body: UpdateUserRequest,
): Promise<ApiResult<User>> {
  return authFetch<User>(baseUrl, accessToken, "PATCH", "/users/@me", body);
}

/** DELETE /api/v1/users/@me — permanently delete the current account. */
export async function deleteAccount(
  baseUrl: string,
  accessToken: string,
  body: DeleteAccountRequest,
): Promise<ApiResult<MessageResponse>> {
  return authFetch<MessageResponse>(baseUrl, accessToken, "DELETE", "/users/@me", body);
}

// ---------------------------------------------------------------------------
// Authenticated helpers
// ---------------------------------------------------------------------------

/** Authenticated GET request. */
async function authGet<T>(
  baseUrl: string,
  accessToken: string,
  path: string,
  opts?: FetchOptions,
): Promise<ApiResult<T>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS, opts?.signal);
  try {
    const res = await fetch(`${apiV1(baseUrl)}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: timeout.signal,
    });
    return parseResponse<T>(res);
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    timeout.clear();
  }
}

/** Authenticated POST/PATCH/PUT/DELETE request with JSON body. */
async function authFetch<T>(
  baseUrl: string,
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
  opts?: FetchOptions,
): Promise<ApiResult<T>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS, opts?.signal);
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    const init: RequestInit = { method, headers, signal: timeout.signal };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${apiV1(baseUrl)}${path}`, init);
    return parseResponse<T>(res);
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    timeout.clear();
  }
}

/** Authenticated DELETE request that expects no response body. */
async function authDelete(
  baseUrl: string,
  accessToken: string,
  path: string,
  opts?: FetchOptions,
): Promise<ApiResult<void>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS, opts?.signal);
  try {
    const res = await fetch(`${apiV1(baseUrl)}${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: timeout.signal,
    });
    return parseEmptyResponse(res);
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    timeout.clear();
  }
}

/** Authenticated multipart upload. */
async function authUpload<T>(
  baseUrl: string,
  accessToken: string,
  path: string,
  formData: FormData,
  opts?: FetchOptions,
): Promise<ApiResult<T>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS, opts?.signal);
  try {
    const res = await fetch(`${apiV1(baseUrl)}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
      signal: timeout.signal,
    });
    return parseResponse<T>(res);
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    timeout.clear();
  }
}

// ---------------------------------------------------------------------------
// Server (authenticated)
// ---------------------------------------------------------------------------

/** GET /api/v1/server — server configuration. */
export async function getServerConfig(baseUrl: string, accessToken: string): Promise<ApiResult<ServerConfig>> {
  return authGet<ServerConfig>(baseUrl, accessToken, "/server");
}

/** PATCH /api/v1/server — update server configuration. */
export async function updateServerConfig(
  baseUrl: string,
  accessToken: string,
  body: UpdateServerConfigRequest,
): Promise<ApiResult<ServerConfig>> {
  return authFetch<ServerConfig>(baseUrl, accessToken, "PATCH", "/server", body);
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/** GET /api/v1/server/channels — list all channels. */
export async function getChannels(baseUrl: string, accessToken: string): Promise<ApiResult<Channel[]>> {
  return authGet<Channel[]>(baseUrl, accessToken, "/server/channels");
}

/** POST /api/v1/server/channels — create a channel. */
export async function createChannel(
  baseUrl: string,
  accessToken: string,
  body: CreateChannelRequest,
): Promise<ApiResult<Channel>> {
  return authFetch<Channel>(baseUrl, accessToken, "POST", "/server/channels", body);
}

/** GET /api/v1/channels/:id — get a single channel. */
export async function getChannel(baseUrl: string, accessToken: string, channelId: string): Promise<ApiResult<Channel>> {
  return authGet<Channel>(baseUrl, accessToken, `/channels/${channelId}`);
}

/** PATCH /api/v1/channels/:id — update a channel. */
export async function updateChannel(
  baseUrl: string,
  accessToken: string,
  channelId: string,
  body: UpdateChannelRequest,
): Promise<ApiResult<Channel>> {
  return authFetch<Channel>(baseUrl, accessToken, "PATCH", `/channels/${channelId}`, body);
}

/** DELETE /api/v1/channels/:id — delete a channel. */
export async function deleteChannel(baseUrl: string, accessToken: string, channelId: string): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/channels/${channelId}`);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** GET /api/v1/server/categories — list all categories. */
export async function getCategories(baseUrl: string, accessToken: string): Promise<ApiResult<Category[]>> {
  return authGet<Category[]>(baseUrl, accessToken, "/server/categories");
}

/** POST /api/v1/server/categories — create a category. */
export async function createCategory(
  baseUrl: string,
  accessToken: string,
  body: CreateCategoryRequest,
): Promise<ApiResult<Category>> {
  return authFetch<Category>(baseUrl, accessToken, "POST", "/server/categories", body);
}

/** PATCH /api/v1/categories/:id — update a category. */
export async function updateCategory(
  baseUrl: string,
  accessToken: string,
  categoryId: string,
  body: UpdateCategoryRequest,
): Promise<ApiResult<Category>> {
  return authFetch<Category>(baseUrl, accessToken, "PATCH", `/categories/${categoryId}`, body);
}

/** DELETE /api/v1/categories/:id — delete a category. */
export async function deleteCategory(
  baseUrl: string,
  accessToken: string,
  categoryId: string,
): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/categories/${categoryId}`);
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** GET /api/v1/server/roles — list all roles. */
export async function getRoles(baseUrl: string, accessToken: string): Promise<ApiResult<Role[]>> {
  return authGet<Role[]>(baseUrl, accessToken, "/server/roles");
}

/** POST /api/v1/server/roles — create a role. */
export async function createRole(
  baseUrl: string,
  accessToken: string,
  body: CreateRoleRequest,
): Promise<ApiResult<Role>> {
  return authFetch<Role>(baseUrl, accessToken, "POST", "/server/roles", body);
}

/** PATCH /api/v1/server/roles/:id — update a role. */
export async function updateRole(
  baseUrl: string,
  accessToken: string,
  roleId: string,
  body: UpdateRoleRequest,
): Promise<ApiResult<Role>> {
  return authFetch<Role>(baseUrl, accessToken, "PATCH", `/server/roles/${roleId}`, body);
}

/** DELETE /api/v1/server/roles/:id — delete a role. */
export async function deleteRole(baseUrl: string, accessToken: string, roleId: string): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/server/roles/${roleId}`);
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/** PUT /api/v1/channels/:id/overrides/:targetId — set a permission override. */
export async function setPermissionOverride(
  baseUrl: string,
  accessToken: string,
  channelId: string,
  targetId: string,
  body: SetOverrideRequest,
): Promise<ApiResult<void>> {
  return authFetch<void>(baseUrl, accessToken, "PUT", `/channels/${channelId}/overrides/${targetId}`, body);
}

/** DELETE /api/v1/channels/:id/overrides/:targetId — remove a permission override. */
export async function removePermissionOverride(
  baseUrl: string,
  accessToken: string,
  channelId: string,
  targetId: string,
  type: "role" | "user",
): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/channels/${channelId}/overrides/${targetId}?type=${type}`);
}

/** GET /api/v1/channels/:id/permissions/@me — get resolved permissions for the current user. */
export async function getMyPermissions(
  baseUrl: string,
  accessToken: string,
  channelId: string,
): Promise<ApiResult<ResolvedPermissions>> {
  return authGet<ResolvedPermissions>(baseUrl, accessToken, `/channels/${channelId}/permissions/@me`);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export type ListMembersParams = {
  limit?: number;
  after?: string;
};

/** GET /api/v1/server/members — list server members. */
export async function listMembers(
  baseUrl: string,
  accessToken: string,
  params?: ListMembersParams,
): Promise<ApiResult<Member[]>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.after) query.set("after", params.after);
  const qs = query.toString();
  return authGet<Member[]>(baseUrl, accessToken, `/server/members${qs ? `?${qs}` : ""}`);
}

/** GET /api/v1/channels/:channelID/members — list members with access to the channel. */
export async function listChannelMembers(
  baseUrl: string,
  accessToken: string,
  channelId: string,
  params?: ListMembersParams,
): Promise<ApiResult<Member[]>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.after) query.set("after", params.after);
  const qs = query.toString();
  return authGet<Member[]>(baseUrl, accessToken, `/channels/${channelId}/members${qs ? `?${qs}` : ""}`);
}

/** GET /api/v1/server/members/@me — get the current user's member profile. */
export async function getSelfMember(baseUrl: string, accessToken: string): Promise<ApiResult<Member>> {
  return authGet<Member>(baseUrl, accessToken, "/server/members/@me");
}

/** PATCH /api/v1/server/members/@me — update own nickname. */
export async function updateSelfNickname(
  baseUrl: string,
  accessToken: string,
  body: UpdateMemberRequest,
): Promise<ApiResult<Member>> {
  return authFetch<Member>(baseUrl, accessToken, "PATCH", "/server/members/@me", body);
}

/** DELETE /api/v1/server/members/@me — leave the server. */
export async function leaveServer(baseUrl: string, accessToken: string): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, "/server/members/@me");
}

/** GET /api/v1/server/members/:id — get a specific member. */
export async function getMember(baseUrl: string, accessToken: string, userId: string): Promise<ApiResult<Member>> {
  return authGet<Member>(baseUrl, accessToken, `/server/members/${userId}`);
}

/** PATCH /api/v1/server/members/:id — update a member's nickname. */
export async function updateMemberNickname(
  baseUrl: string,
  accessToken: string,
  userId: string,
  body: UpdateMemberRequest,
): Promise<ApiResult<Member>> {
  return authFetch<Member>(baseUrl, accessToken, "PATCH", `/server/members/${userId}`, body);
}

/** DELETE /api/v1/server/members/:id — kick a member. */
export async function kickMember(baseUrl: string, accessToken: string, userId: string): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/server/members/${userId}`);
}

/** PUT /api/v1/server/members/:id/timeout — timeout a member. */
export async function setMemberTimeout(
  baseUrl: string,
  accessToken: string,
  userId: string,
  body: TimeoutMemberRequest,
): Promise<ApiResult<void>> {
  return authFetch<void>(baseUrl, accessToken, "PUT", `/server/members/${userId}/timeout`, body);
}

/** DELETE /api/v1/server/members/:id/timeout — clear a member's timeout. */
export async function clearMemberTimeout(
  baseUrl: string,
  accessToken: string,
  userId: string,
): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/server/members/${userId}/timeout`);
}

/** PUT /api/v1/server/members/:id/roles/:roleId — assign a role to a member. */
export async function assignRole(
  baseUrl: string,
  accessToken: string,
  userId: string,
  roleId: string,
): Promise<ApiResult<void>> {
  return authFetch<void>(baseUrl, accessToken, "PUT", `/server/members/${userId}/roles/${roleId}`);
}

/** DELETE /api/v1/server/members/:id/roles/:roleId — remove a role from a member. */
export async function removeRole(
  baseUrl: string,
  accessToken: string,
  userId: string,
  roleId: string,
): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/server/members/${userId}/roles/${roleId}`);
}

// ---------------------------------------------------------------------------
// Bans
// ---------------------------------------------------------------------------

/** GET /api/v1/server/bans — list all bans. */
export async function listBans(baseUrl: string, accessToken: string): Promise<ApiResult<Ban[]>> {
  return authGet<Ban[]>(baseUrl, accessToken, "/server/bans");
}

/** PUT /api/v1/server/bans/:userId — ban a member. */
export async function banMember(
  baseUrl: string,
  accessToken: string,
  userId: string,
  body: BanMemberRequest,
): Promise<ApiResult<void>> {
  return authFetch<void>(baseUrl, accessToken, "PUT", `/server/bans/${userId}`, body);
}

/** DELETE /api/v1/server/bans/:userId — unban a member. */
export async function unbanMember(baseUrl: string, accessToken: string, userId: string): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/server/bans/${userId}`);
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

/** POST /api/v1/server/invites — create an invite. */
export async function createInvite(
  baseUrl: string,
  accessToken: string,
  body: CreateInviteRequest,
): Promise<ApiResult<Invite>> {
  return authFetch<Invite>(baseUrl, accessToken, "POST", "/server/invites", body);
}

export type ListInvitesParams = {
  limit?: number;
  after?: string;
};

/** GET /api/v1/server/invites — list all invites. */
export async function listInvites(
  baseUrl: string,
  accessToken: string,
  params?: ListInvitesParams,
): Promise<ApiResult<Invite[]>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.after) query.set("after", params.after);
  const qs = query.toString();
  return authGet<Invite[]>(baseUrl, accessToken, `/server/invites${qs ? `?${qs}` : ""}`);
}

/** DELETE /api/v1/invites/:code — delete an invite. */
export async function deleteInvite(baseUrl: string, accessToken: string, code: string): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/invites/${code}`);
}

/** POST /api/v1/invites/:code/join — join a server via invite. */
export async function joinInvite(baseUrl: string, accessToken: string, code: string): Promise<ApiResult<Member>> {
  return authFetch<Member>(baseUrl, accessToken, "POST", `/invites/${code}/join`);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type GetMessagesParams = {
  limit?: number;
  before?: string;
};

/** GET /api/v1/channels/:id/messages — list messages in a channel. */
export async function getMessages(
  baseUrl: string,
  accessToken: string,
  channelId: string,
  params?: GetMessagesParams,
): Promise<ApiResult<Message[]>> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.before) query.set("before", params.before);
  const qs = query.toString();
  const path = `/channels/${channelId}/messages${qs ? `?${qs}` : ""}`;
  return authGet<Message[]>(baseUrl, accessToken, path);
}

/** POST /api/v1/channels/:id/messages — send a message. */
export async function sendMessage(
  baseUrl: string,
  accessToken: string,
  channelId: string,
  body: CreateMessageRequest,
): Promise<ApiResult<Message>> {
  return authFetch<Message>(baseUrl, accessToken, "POST", `/channels/${channelId}/messages`, body);
}

/** POST /api/v1/channels/:id/attachments — upload a file attachment. */
export async function uploadAttachment(
  baseUrl: string,
  accessToken: string,
  channelId: string,
  formData: FormData,
): Promise<ApiResult<Attachment>> {
  return authUpload<Attachment>(baseUrl, accessToken, `/channels/${channelId}/attachments`, formData);
}

/** PATCH /api/v1/messages/:id — edit a message. */
export async function editMessage(
  baseUrl: string,
  accessToken: string,
  messageId: string,
  body: UpdateMessageRequest,
): Promise<ApiResult<Message>> {
  return authFetch<Message>(baseUrl, accessToken, "PATCH", `/messages/${messageId}`, body);
}

/** DELETE /api/v1/messages/:id — delete a message. */
export async function deleteMessage(baseUrl: string, accessToken: string, messageId: string): Promise<ApiResult<void>> {
  return authDelete(baseUrl, accessToken, `/messages/${messageId}`);
}

// ---------------------------------------------------------------------------
// Typing
// ---------------------------------------------------------------------------

/** POST /api/v1/channels/:id/typing — notify that the current user is typing. */
export async function startTyping(baseUrl: string, accessToken: string, channelId: string): Promise<ApiResult<void>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiV1(baseUrl)}/channels/${channelId}/typing`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: timeout.signal,
    });
    return parseEmptyResponse(res);
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    timeout.clear();
  }
}

/** DELETE /api/v1/channels/:id/typing — notify that the current user stopped typing. */
export async function stopTyping(baseUrl: string, accessToken: string, channelId: string): Promise<ApiResult<void>> {
  const timeout = timeoutSignal(DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiV1(baseUrl)}/channels/${channelId}/typing`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: timeout.signal,
    });
    return parseEmptyResponse(res);
  } catch (e) {
    return { ok: false, code: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" };
  } finally {
    timeout.clear();
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchMessagesParams = {
  q: string;
  channel_id?: string;
  author_id?: string;
  page?: number;
  per_page?: number;
};

/** GET /api/v1/search/messages — search messages. */
export async function searchMessages(
  baseUrl: string,
  accessToken: string,
  params: SearchMessagesParams,
): Promise<ApiResult<SearchResponse>> {
  const query = new URLSearchParams();
  query.set("q", params.q);
  if (params.channel_id) query.set("channel_id", params.channel_id);
  if (params.author_id) query.set("author_id", params.author_id);
  if (params.page) query.set("page", String(params.page));
  if (params.per_page) query.set("per_page", String(params.per_page));
  return authGet<SearchResponse>(baseUrl, accessToken, `/search/messages?${query.toString()}`);
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

/** GET /api/v1/onboarding — full onboarding configuration with documents. */
export async function getOnboardingConfig(baseUrl: string, accessToken: string): Promise<ApiResult<OnboardingConfig>> {
  return authGet<OnboardingConfig>(baseUrl, accessToken, "/onboarding");
}

/** GET /api/v1/onboarding/status — server-computed next onboarding step. */
export async function getOnboardingStatus(
  baseUrl: string,
  accessToken: string,
): Promise<ApiResult<OnboardingStatusResponse>> {
  return authGet<OnboardingStatusResponse>(baseUrl, accessToken, "/onboarding/status");
}

/** POST /api/v1/onboarding/accept — accept onboarding documents and activate membership. */
export async function acceptOnboarding(
  baseUrl: string,
  accessToken: string,
  body: AcceptOnboardingRequest,
): Promise<ApiResult<Member>> {
  return authFetch<Member>(baseUrl, accessToken, "POST", "/onboarding/accept", body);
}

/** POST /api/v1/server/join — join a server via open join. */
export async function joinServer(baseUrl: string, accessToken: string): Promise<ApiResult<Member>> {
  return authFetch<Member>(baseUrl, accessToken, "POST", "/server/join");
}

/** POST /api/v1/auth/resend-verification — resend email verification (60s cooldown). */
export async function resendVerification(baseUrl: string, accessToken: string): Promise<ApiResult<MessageResponse>> {
  return authFetch<MessageResponse>(baseUrl, accessToken, "POST", "/auth/resend-verification");
}

// ---------------------------------------------------------------------------
// MFA management (authenticated)
// ---------------------------------------------------------------------------

/** POST /api/v1/users/@me/mfa/enable — start MFA setup. */
export async function enableMfa(
  baseUrl: string,
  accessToken: string,
  body: MFAEnableRequest,
): Promise<ApiResult<MFASetupResponse>> {
  return authFetch<MFASetupResponse>(baseUrl, accessToken, "POST", "/users/@me/mfa/enable", body);
}

/** POST /api/v1/users/@me/mfa/confirm — confirm MFA setup with TOTP code. */
export async function confirmMfa(
  baseUrl: string,
  accessToken: string,
  body: MFAConfirmRequest,
): Promise<ApiResult<MFAConfirmResponse>> {
  return authFetch<MFAConfirmResponse>(baseUrl, accessToken, "POST", "/users/@me/mfa/confirm", body);
}

/** POST /api/v1/users/@me/mfa/disable — disable MFA. */
export async function disableMfa(
  baseUrl: string,
  accessToken: string,
  body: MFADisableRequest,
): Promise<ApiResult<MessageResponse>> {
  return authFetch<MessageResponse>(baseUrl, accessToken, "POST", "/users/@me/mfa/disable", body);
}

/** POST /api/v1/users/@me/mfa/recovery-codes — regenerate recovery codes. */
export async function regenerateRecoveryCodes(
  baseUrl: string,
  accessToken: string,
  body: MFARegenerateCodesRequest,
): Promise<ApiResult<MFARegenerateCodesResponse>> {
  return authFetch<MFARegenerateCodesResponse>(baseUrl, accessToken, "POST", "/users/@me/mfa/recovery-codes", body);
}
