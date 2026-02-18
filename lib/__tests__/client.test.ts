import {
  healthCheck,
  login,
  register,
  refresh,
  getMe,
  getPublicServerInfo,
  mfaVerify,
  verifyEmail,
  verifyPassword,
  updateMe,
  deleteAccount,
  getServerConfig,
  updateServerConfig,
  getChannels,
  createChannel,
  getChannel,
  updateChannel,
  deleteChannel,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  setPermissionOverride,
  removePermissionOverride,
  getMyPermissions,
  listMembers,
  listChannelMembers,
  getSelfMember,
  updateSelfNickname,
  leaveServer,
  getMember,
  updateMemberNickname,
  kickMember,
  setMemberTimeout,
  clearMemberTimeout,
  assignRole,
  removeRole,
  listBans,
  banMember,
  unbanMember,
  createInvite,
  listInvites,
  deleteInvite,
  joinInvite,
  getMessages,
  sendMessage,
  uploadAttachment,
  editMessage,
  deleteMessage,
  startTyping,
  stopTyping,
  searchMessages,
  getOnboardingConfig,
  getOnboardingStatus,
  acceptOnboarding,
  joinServer,
  resendVerification,
  enableMfa,
  confirmMfa,
  disableMfa,
  regenerateRecoveryCodes,
} from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:8080";
const TOKEN = "test-token";

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status, statusText: "No Content", headers: { "Content-Length": "0" } });
}

// ---------------------------------------------------------------------------
// parseResponse behaviour (tested via public API wrappers)
// ---------------------------------------------------------------------------

describe("parseResponse (via API wrappers)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns data from a well-formed success response", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "user-1", username: "alice" } }));

    const result = await getPublicServerInfo(BASE_URL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: "user-1", username: "alice" });
    }
  });

  it("returns error from a well-formed error response", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Email is required" } }));

    const result = await getPublicServerInfo(BASE_URL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
      expect(result.message).toBe("Email is required");
    }
  });

  it("handles malformed JSON in response body", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("not json", { status: 200, statusText: "OK" }));

    const result = await getPublicServerInfo(BASE_URL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("200");
    }
  });

  it("handles missing data envelope", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { unexpected: "format" }));

    const result = await getPublicServerInfo(BASE_URL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Invalid response format");
    }
  });

  it("returns RATE_LIMITED code for 429 with unparseable body", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("rate limited", { status: 429, statusText: "Too Many Requests" }));

    const result = await getPublicServerInfo(BASE_URL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RATE_LIMITED");
    }
  });

  it("validates error code is a string before casting", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: 12345, message: "Numeric code" } }));

    const result = await getPublicServerInfo(BASE_URL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INTERNAL_ERROR");
    }
  });

  it("handles network errors", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const result = await getPublicServerInfo(BASE_URL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Network failure");
    }
  });
});

// ---------------------------------------------------------------------------
// healthCheck
// ---------------------------------------------------------------------------

describe("healthCheck", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns status on a healthy server", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: { status: "ok" } }));

    const result = await healthCheck(BASE_URL);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("ok");
    }
  });

  it("returns error when health check fails", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(503, { error: { code: "INTERNAL_ERROR", message: "Service unavailable" } }));

    const result = await healthCheck(BASE_URL);
    expect(result.ok).toBe(false);
  });

  it("handles network errors", async () => {
    jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await healthCheck(BASE_URL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("ECONNREFUSED");
    }
  });
});

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

describe("auth endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("login returns auth response on success", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { access_token: "at", refresh_token: "rt", user: { id: "u1" } } }),
      );

    const result = await login(BASE_URL, { email: "a@b.com", password: "pass" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("access_token");
    }
  });

  it("login returns error on invalid credentials", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong password" } }));

    const result = await login(BASE_URL, { email: "a@b.com", password: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CREDENTIALS");
    }
  });

  it("register returns auth response on success", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(201, { data: { access_token: "at", refresh_token: "rt", user: { id: "u2" } } }),
      );

    const result = await register(BASE_URL, { email: "a@b.com", username: "alice", password: "pass" });
    expect(result.ok).toBe(true);
  });

  it("refresh returns new token pair", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { access_token: "new-at", refresh_token: "new-rt" } }));

    const result = await refresh(BASE_URL, { refresh_token: "old-rt" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.access_token).toBe("new-at");
      expect(result.data.refresh_token).toBe("new-rt");
    }
  });

  it("getMe returns user data with auth header", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "u1", username: "alice" } }));

    const result = await getMe(BASE_URL, "my-token");
    expect(result.ok).toBe(true);

    // Verify auth header was sent
    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer my-token");
  });
});

// ---------------------------------------------------------------------------
// timeoutSignal behaviour (tested via healthCheck with AbortSignal)
// ---------------------------------------------------------------------------

describe("timeoutSignal (via API calls)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("respects external abort signal", async () => {
    const controller = new AbortController();
    controller.abort(new Error("User cancelled"));

    jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

    const result = await healthCheck(BASE_URL, { signal: controller.signal });
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Auth (untested)
// ---------------------------------------------------------------------------

describe("auth (additional endpoints)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mfaVerify returns auth response on success", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { access_token: "at", refresh_token: "rt", user: { id: "u1" } } }),
      );

    const result = await mfaVerify(BASE_URL, { ticket: "tok", code: "123456" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("access_token");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/auth/mfa/verify`);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ ticket: "tok", code: "123456" });
  });

  it("mfaVerify returns error on invalid code", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "INVALID_MFA_CODE", message: "Bad code" } }));

    const result = await mfaVerify(BASE_URL, { ticket: "tok", code: "000000" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_MFA_CODE");
    }
  });

  it("verifyEmail returns message on success", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { message: "Email verified" } }));

    const result = await verifyEmail(BASE_URL, { token: "verify-tok" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.message).toBe("Email verified");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/auth/verify-email`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: "verify-tok" });
  });

  it("verifyEmail returns error on invalid token", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "INVALID_TOKEN", message: "Expired" } }));

    const result = await verifyEmail(BASE_URL, { token: "bad" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_TOKEN");
    }
  });

  it("verifyPassword returns message on success with auth header", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { message: "Password correct" } }));

    const result = await verifyPassword(BASE_URL, TOKEN, { password: "secret" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/auth/verify-password`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ password: "secret" });
  });

  it("verifyPassword returns error on wrong password", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong" } }));

    const result = await verifyPassword(BASE_URL, TOKEN, { password: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CREDENTIALS");
    }
  });
});

// ---------------------------------------------------------------------------
// Users (untested)
// ---------------------------------------------------------------------------

describe("users endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("updateMe returns updated user", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "u1", display_name: "Bob" } }));

    const result = await updateMe(BASE_URL, TOKEN, { display_name: "Bob" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("display_name", "Bob");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/users/@me`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ display_name: "Bob" });
  });

  it("updateMe returns error on validation failure", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Display name too short" } }),
      );

    const result = await updateMe(BASE_URL, TOKEN, { display_name: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });

  it("deleteAccount returns message on success", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { message: "Account deleted" } }));

    const result = await deleteAccount(BASE_URL, TOKEN, { password: "secret" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/users/@me`);
    expect((init as RequestInit).method).toBe("DELETE");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ password: "secret" });
  });

  it("deleteAccount returns error on wrong password", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong password" } }));

    const result = await deleteAccount(BASE_URL, TOKEN, { password: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CREDENTIALS");
    }
  });
});

// ---------------------------------------------------------------------------
// Server (authenticated)
// ---------------------------------------------------------------------------

describe("server config endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("getServerConfig returns config", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { name: "My Server", description: "A server" } }));

    const result = await getServerConfig(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("name", "My Server");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server`);
    expect((init as RequestInit).method).toBe("GET");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("getServerConfig returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Not authenticated" } }));

    const result = await getServerConfig(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("updateServerConfig returns updated config", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { name: "Renamed", description: "New desc" } }));

    const result = await updateServerConfig(BASE_URL, TOKEN, { name: "Renamed" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("name", "Renamed");
    }

    const [, init] = fetchSpy.mock.calls[0];
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Renamed" });
  });

  it("updateServerConfig returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await updateServerConfig(BASE_URL, TOKEN, { name: "Renamed" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

describe("channel endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("getChannels returns channel list", async () => {
    const channels = [{ id: "c1", name: "general" }];
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: channels }));

    const result = await getChannels(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(channels);
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/channels`);
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("getChannels returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await getChannels(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("createChannel returns created channel", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: "c2", name: "new-channel" } }));

    const result = await createChannel(BASE_URL, TOKEN, { name: "new-channel" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/channels`);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "new-channel" });
  });

  it("createChannel returns error on validation failure", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Name required" } }));

    const result = await createChannel(BASE_URL, TOKEN, { name: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });

  it("getChannel returns a single channel", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "c1", name: "general" } }));

    const result = await getChannel(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(true);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1`);
  });

  it("getChannel returns error when not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Channel not found" } }));

    const result = await getChannel(BASE_URL, TOKEN, "missing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
    }
  });

  it("updateChannel returns updated channel", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "c1", name: "renamed" } }));

    const result = await updateChannel(BASE_URL, TOKEN, "c1", { name: "renamed" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "renamed" });
  });

  it("updateChannel returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await updateChannel(BASE_URL, TOKEN, "c1", { name: "renamed" });
    expect(result.ok).toBe(false);
  });

  it("deleteChannel returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await deleteChannel(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeUndefined();
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1`);
    expect((init as RequestInit).method).toBe("DELETE");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("deleteChannel returns error when not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found" } }));

    const result = await deleteChannel(BASE_URL, TOKEN, "missing");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

describe("category endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("getCategories returns category list", async () => {
    const categories = [{ id: "cat1", name: "General" }];
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: categories }));

    const result = await getCategories(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(categories);
    }

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/categories`);
  });

  it("getCategories returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await getCategories(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("createCategory returns created category", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: "cat2", name: "New Category" } }));

    const result = await createCategory(BASE_URL, TOKEN, { name: "New Category" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/categories`);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "New Category" });
  });

  it("createCategory returns error on validation failure", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Name required" } }));

    const result = await createCategory(BASE_URL, TOKEN, { name: "" });
    expect(result.ok).toBe(false);
  });

  it("updateCategory returns updated category", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "cat1", name: "Renamed" } }));

    const result = await updateCategory(BASE_URL, TOKEN, "cat1", { name: "Renamed" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/categories/cat1`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Renamed" });
  });

  it("updateCategory returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Not found" } }));

    const result = await updateCategory(BASE_URL, TOKEN, "missing", { name: "X" });
    expect(result.ok).toBe(false);
  });

  it("deleteCategory returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await deleteCategory(BASE_URL, TOKEN, "cat1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeUndefined();
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/categories/cat1`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("deleteCategory returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await deleteCategory(BASE_URL, TOKEN, "cat1");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

describe("role endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("getRoles returns role list", async () => {
    const roles = [{ id: "r1", name: "Admin" }];
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: roles }));

    const result = await getRoles(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(roles);
    }

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/roles`);
  });

  it("getRoles returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await getRoles(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("createRole returns created role", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: "r2", name: "Mod" } }));

    const result = await createRole(BASE_URL, TOKEN, { name: "Mod", colour: 0xff0000, permissions: 0 });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/roles`);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      name: "Mod",
      colour: 0xff0000,
      permissions: 0,
    });
  });

  it("createRole returns error on validation failure", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Name required" } }));

    const result = await createRole(BASE_URL, TOKEN, { name: "", colour: 0, permissions: 0 });
    expect(result.ok).toBe(false);
  });

  it("updateRole returns updated role", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "r1", name: "Super Admin" } }));

    const result = await updateRole(BASE_URL, TOKEN, "r1", { name: "Super Admin" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/roles/r1`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "Super Admin" });
  });

  it("updateRole returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Role not found" } }));

    const result = await updateRole(BASE_URL, TOKEN, "missing", { name: "X" });
    expect(result.ok).toBe(false);
  });

  it("deleteRole returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await deleteRole(BASE_URL, TOKEN, "r1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeUndefined();
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/roles/r1`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("deleteRole returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await deleteRole(BASE_URL, TOKEN, "r1");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

describe("permission endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("setPermissionOverride sends PUT with body", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: null }));

    const body = { type: "role" as const, allow: 1, deny: 0 };
    const result = await setPermissionOverride(BASE_URL, TOKEN, "c1", "r1", body);
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/overrides/r1`);
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(body);
  });

  it("setPermissionOverride returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await setPermissionOverride(BASE_URL, TOKEN, "c1", "r1", {
      type: "role",
      allow: 1,
      deny: 0,
    });
    expect(result.ok).toBe(false);
  });

  it("removePermissionOverride sends DELETE with type query param for role", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await removePermissionOverride(BASE_URL, TOKEN, "c1", "r1", "role");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/overrides/r1?type=role`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("removePermissionOverride sends DELETE with type query param for user", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await removePermissionOverride(BASE_URL, TOKEN, "c1", "u1", "user");
    expect(result.ok).toBe(true);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/overrides/u1?type=user`);
  });

  it("removePermissionOverride returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Override not found" } }));

    const result = await removePermissionOverride(BASE_URL, TOKEN, "c1", "r1", "role");
    expect(result.ok).toBe(false);
  });

  it("getMyPermissions returns resolved permissions", async () => {
    const perms = { allow: "123", deny: "0" };
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: perms }));

    const result = await getMyPermissions(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(perms);
    }

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/permissions/@me`);
  });

  it("getMyPermissions returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await getMyPermissions(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

describe("member endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("listMembers returns member list", async () => {
    const members = [{ user_id: "u1", nickname: "Alice" }];
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: members }));

    const result = await listMembers(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(members);
    }

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members`);
  });

  it("listMembers appends pagination params", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await listMembers(BASE_URL, TOKEN, { limit: 25, after: "cursor123" });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members?limit=25&after=cursor123`);
  });

  it("listMembers returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await listMembers(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("listChannelMembers returns members for a channel", async () => {
    const members = [{ user_id: "u1" }];
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: members }));

    const result = await listChannelMembers(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(true);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/members`);
  });

  it("listChannelMembers appends pagination params", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await listChannelMembers(BASE_URL, TOKEN, "c1", { limit: 10, after: "abc" });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/members?limit=10&after=abc`);
  });

  it("listChannelMembers returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Channel not found" } }));

    const result = await listChannelMembers(BASE_URL, TOKEN, "missing");
    expect(result.ok).toBe(false);
  });

  it("getSelfMember returns current member", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { user_id: "u1", nickname: "Me" } }));

    const result = await getSelfMember(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/@me`);
  });

  it("getSelfMember returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await getSelfMember(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("updateSelfNickname returns updated member", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { user_id: "u1", nickname: "New Nick" } }));

    const result = await updateSelfNickname(BASE_URL, TOKEN, { nickname: "New Nick" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/@me`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ nickname: "New Nick" });
  });

  it("updateSelfNickname returns error on validation failure", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Too long" } }));

    const result = await updateSelfNickname(BASE_URL, TOKEN, { nickname: "x".repeat(100) });
    expect(result.ok).toBe(false);
  });

  it("leaveServer returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await leaveServer(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/@me`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("leaveServer returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "Owner cannot leave" } }));

    const result = await leaveServer(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("getMember returns a specific member", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { user_id: "u2", nickname: "Bob" } }));

    const result = await getMember(BASE_URL, TOKEN, "u2");
    expect(result.ok).toBe(true);

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/u2`);
  });

  it("getMember returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Member not found" } }));

    const result = await getMember(BASE_URL, TOKEN, "missing");
    expect(result.ok).toBe(false);
  });

  it("updateMemberNickname returns updated member", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { user_id: "u2", nickname: "Bobby" } }));

    const result = await updateMemberNickname(BASE_URL, TOKEN, "u2", { nickname: "Bobby" });
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/u2`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ nickname: "Bobby" });
  });

  it("updateMemberNickname returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await updateMemberNickname(BASE_URL, TOKEN, "u2", { nickname: "X" });
    expect(result.ok).toBe(false);
  });

  it("kickMember returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await kickMember(BASE_URL, TOKEN, "u2");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/u2`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("kickMember returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await kickMember(BASE_URL, TOKEN, "u2");
    expect(result.ok).toBe(false);
  });

  it("setMemberTimeout sends PUT with body", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: null }));

    const body = { until: "2026-03-01T00:00:00Z" };
    const result = await setMemberTimeout(BASE_URL, TOKEN, "u2", body);
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/u2/timeout`);
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(body);
  });

  it("setMemberTimeout returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await setMemberTimeout(BASE_URL, TOKEN, "u2", { until: "2026-03-01T00:00:00Z" });
    expect(result.ok).toBe(false);
  });

  it("clearMemberTimeout returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await clearMemberTimeout(BASE_URL, TOKEN, "u2");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/u2/timeout`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("clearMemberTimeout returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "No timeout" } }));

    const result = await clearMemberTimeout(BASE_URL, TOKEN, "u2");
    expect(result.ok).toBe(false);
  });

  it("assignRole sends PUT to correct path", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: null }));

    const result = await assignRole(BASE_URL, TOKEN, "u2", "r1");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/u2/roles/r1`);
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("assignRole returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await assignRole(BASE_URL, TOKEN, "u2", "r1");
    expect(result.ok).toBe(false);
  });

  it("removeRole returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await removeRole(BASE_URL, TOKEN, "u2", "r1");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/members/u2/roles/r1`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("removeRole returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Role not assigned" } }));

    const result = await removeRole(BASE_URL, TOKEN, "u2", "r1");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bans
// ---------------------------------------------------------------------------

describe("ban endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("listBans returns ban list", async () => {
    const bans = [{ user_id: "u3", reason: "Spam" }];
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: bans }));

    const result = await listBans(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(bans);
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/bans`);
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("listBans returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await listBans(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("banMember sends PUT with body", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: null }));

    const body = { reason: "Spam" };
    const result = await banMember(BASE_URL, TOKEN, "u3", body);
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/bans/u3`);
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(body);
  });

  it("banMember returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await banMember(BASE_URL, TOKEN, "u3", { reason: "Spam" });
    expect(result.ok).toBe(false);
  });

  it("unbanMember returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await unbanMember(BASE_URL, TOKEN, "u3");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/bans/u3`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("unbanMember returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Ban not found" } }));

    const result = await unbanMember(BASE_URL, TOKEN, "u3");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

describe("invite endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("createInvite returns created invite", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(201, { data: { code: "abc123", uses: 0 } }));

    const body = { channel_id: "c1", max_uses: 10 };
    const result = await createInvite(BASE_URL, TOKEN, body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("code", "abc123");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/invites`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(body);
  });

  it("createInvite returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No permission" } }));

    const result = await createInvite(BASE_URL, TOKEN, { channel_id: "c1", max_uses: 10 });
    expect(result.ok).toBe(false);
  });

  it("listInvites returns invite list", async () => {
    const invites = [{ code: "abc123" }];
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: invites }));

    const result = await listInvites(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(invites);
    }

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/invites`);
  });

  it("listInvites appends pagination params", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await listInvites(BASE_URL, TOKEN, { limit: 5, after: "inv-cursor" });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/invites?limit=5&after=inv-cursor`);
  });

  it("listInvites returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await listInvites(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("deleteInvite returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await deleteInvite(BASE_URL, TOKEN, "abc123");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/invites/abc123`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("deleteInvite returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Invite not found" } }));

    const result = await deleteInvite(BASE_URL, TOKEN, "bad-code");
    expect(result.ok).toBe(false);
  });

  it("joinInvite returns member on success", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { user_id: "u1", nickname: null } }));

    const result = await joinInvite(BASE_URL, TOKEN, "abc123");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("user_id", "u1");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/invites/abc123/join`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("joinInvite returns error on expired invite", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(410, { error: { code: "INVITE_EXPIRED", message: "Invite expired" } }));

    const result = await joinInvite(BASE_URL, TOKEN, "expired");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVITE_EXPIRED");
    }
  });
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

describe("message endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("getMessages returns message list", async () => {
    const messages = [{ id: "m1", content: "Hello" }];
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: messages }));

    const result = await getMessages(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(messages);
    }

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/messages`);
  });

  it("getMessages appends limit and before params", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await getMessages(BASE_URL, TOKEN, "c1", { limit: 50, before: "m99" });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/messages?limit=50&before=m99`);
  });

  it("getMessages returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Channel not found" } }));

    const result = await getMessages(BASE_URL, TOKEN, "missing");
    expect(result.ok).toBe(false);
  });

  it("sendMessage returns created message", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(201, { data: { id: "m2", content: "Hi there" } }));

    const body = { content: "Hi there" };
    const result = await sendMessage(BASE_URL, TOKEN, "c1", body);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("content", "Hi there");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/messages`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(body);
  });

  it("sendMessage returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "Cannot send" } }));

    const result = await sendMessage(BASE_URL, TOKEN, "c1", { content: "test" });
    expect(result.ok).toBe(false);
  });

  it("uploadAttachment sends FormData with auth header", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "att1", filename: "image.png", url: "/files/att1" } }));

    const formData = new FormData();
    formData.append("file", new Blob(["test"]), "image.png");

    const result = await uploadAttachment(BASE_URL, TOKEN, "c1", formData);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id", "att1");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/attachments`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    // Content-Type should NOT be set manually for FormData (browser sets boundary)
    expect((init as RequestInit).headers as Record<string, string>).not.toHaveProperty("Content-Type");
    expect((init as RequestInit).body).toBe(formData);
  });

  it("uploadAttachment returns error on too large", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(413, { error: { code: "FILE_TOO_LARGE", message: "Max 10MB" } }));

    const formData = new FormData();
    const result = await uploadAttachment(BASE_URL, TOKEN, "c1", formData);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FILE_TOO_LARGE");
    }
  });

  it("editMessage returns updated message", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "m1", content: "Edited" } }));

    const result = await editMessage(BASE_URL, TOKEN, "m1", { content: "Edited" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("content", "Edited");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/messages/m1`);
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ content: "Edited" });
  });

  it("editMessage returns error on not found", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(404, { error: { code: "NOT_FOUND", message: "Message not found" } }));

    const result = await editMessage(BASE_URL, TOKEN, "missing", { content: "X" });
    expect(result.ok).toBe(false);
  });

  it("deleteMessage returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await deleteMessage(BASE_URL, TOKEN, "m1");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/messages/m1`);
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("deleteMessage returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "Not your message" } }));

    const result = await deleteMessage(BASE_URL, TOKEN, "m1");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Typing
// ---------------------------------------------------------------------------

describe("typing endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("startTyping returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await startTyping(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/typing`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("startTyping returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No access" } }));

    const result = await startTyping(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(false);
  });

  it("stopTyping returns void on 204", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(emptyResponse(204));

    const result = await stopTyping(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/channels/c1/typing`);
    expect((init as RequestInit).method).toBe("DELETE");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("stopTyping returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "No access" } }));

    const result = await stopTyping(BASE_URL, TOKEN, "c1");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe("search endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("searchMessages returns search results", async () => {
    const searchData = { messages: [{ id: "m1", content: "match" }], total: 1 };
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: searchData }));

    const result = await searchMessages(BASE_URL, TOKEN, { q: "hello" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(searchData);
    }

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/search/messages?q=hello`);
  });

  it("searchMessages includes all query params", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { messages: [], total: 0 } }));

    await searchMessages(BASE_URL, TOKEN, {
      q: "test",
      channel_id: "c1",
      author_id: "u1",
      page: 2,
      per_page: 10,
    });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/search/messages?q=test&channel_id=c1&author_id=u1&page=2&per_page=10`);
  });

  it("searchMessages returns error on bad request", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Query required" } }));

    const result = await searchMessages(BASE_URL, TOKEN, { q: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

describe("onboarding endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("getOnboardingConfig returns config", async () => {
    const config = { documents: [], require_email_verification: true };
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: config }));

    const result = await getOnboardingConfig(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(config);
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/onboarding`);
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("getOnboardingConfig returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await getOnboardingConfig(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("getOnboardingStatus returns status", async () => {
    const status = { next_step: "verify_email" };
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: status }));

    const result = await getOnboardingStatus(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(status);
    }

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/onboarding/status`);
  });

  it("getOnboardingStatus returns error on unauthorised", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "UNAUTHORIZED", message: "Bad token" } }));

    const result = await getOnboardingStatus(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("acceptOnboarding returns member on success", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { user_id: "u1", nickname: null } }));

    const body = { accepted_document_slugs: ["terms-of-service", "privacy-policy"] };
    const result = await acceptOnboarding(BASE_URL, TOKEN, body);
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/onboarding/accept`);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(body);
  });

  it("acceptOnboarding returns error on bad request", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Must accept all" } }));

    const result = await acceptOnboarding(BASE_URL, TOKEN, { accepted_document_slugs: [] });
    expect(result.ok).toBe(false);
  });

  it("joinServer returns member on success", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { user_id: "u1", nickname: null } }));

    const result = await joinServer(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/server/join`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("joinServer returns error on forbidden", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(403, { error: { code: "FORBIDDEN", message: "Join disabled" } }));

    const result = await joinServer(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
  });

  it("resendVerification returns message on success", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { message: "Verification email sent" } }));

    const result = await resendVerification(BASE_URL, TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("message");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/auth/resend-verification`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
  });

  it("resendVerification returns error on rate limit", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(429, { error: { code: "RATE_LIMITED", message: "Wait 60s" } }));

    const result = await resendVerification(BASE_URL, TOKEN);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RATE_LIMITED");
    }
  });
});

// ---------------------------------------------------------------------------
// MFA management
// ---------------------------------------------------------------------------

describe("MFA management endpoints", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("enableMfa returns setup response", async () => {
    const setupData = { secret: "ABCDEF", qr_uri: "otpauth://totp/..." };
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: setupData }));

    const result = await enableMfa(BASE_URL, TOKEN, { password: "secret" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(setupData);
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/users/@me/mfa/enable`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ password: "secret" });
  });

  it("enableMfa returns error on wrong password", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong password" } }));

    const result = await enableMfa(BASE_URL, TOKEN, { password: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CREDENTIALS");
    }
  });

  it("confirmMfa returns confirm response with recovery codes", async () => {
    const confirmData = { recovery_codes: ["code1", "code2"] };
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: confirmData }));

    const result = await confirmMfa(BASE_URL, TOKEN, { code: "123456" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(confirmData);
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/users/@me/mfa/confirm`);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ code: "123456" });
  });

  it("confirmMfa returns error on invalid code", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(400, { error: { code: "INVALID_MFA_CODE", message: "Bad code" } }));

    const result = await confirmMfa(BASE_URL, TOKEN, { code: "000000" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_MFA_CODE");
    }
  });

  it("disableMfa returns message on success", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(200, { data: { message: "MFA disabled" } }));

    const result = await disableMfa(BASE_URL, TOKEN, { password: "secret", code: "123456" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("message", "MFA disabled");
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/users/@me/mfa/disable`);
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ password: "secret", code: "123456" });
  });

  it("disableMfa returns error on wrong password", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong password" } }));

    const result = await disableMfa(BASE_URL, TOKEN, { password: "wrong", code: "123456" });
    expect(result.ok).toBe(false);
  });

  it("regenerateRecoveryCodes returns new codes", async () => {
    const codesData = { recovery_codes: ["new1", "new2", "new3"] };
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(200, { data: codesData }));

    const result = await regenerateRecoveryCodes(BASE_URL, TOKEN, { password: "secret" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(codesData);
    }

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/users/@me/mfa/recovery-codes`);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers as Record<string, string>).toHaveProperty("Authorization", `Bearer ${TOKEN}`);
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ password: "secret" });
  });

  it("regenerateRecoveryCodes returns error on wrong password", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: "INVALID_CREDENTIALS", message: "Wrong password" } }));

    const result = await regenerateRecoveryCodes(BASE_URL, TOKEN, { password: "wrong" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_CREDENTIALS");
    }
  });
});
