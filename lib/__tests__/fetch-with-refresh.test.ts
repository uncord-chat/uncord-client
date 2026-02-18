import { fetchWithRefresh, getValidToken } from "@/lib/api/fetch-with-refresh";
import * as tokenStore from "@/lib/auth/token-store";

jest.mock("@/lib/auth/token-store");

const mockGetAccessToken = tokenStore.getAccessToken as jest.MockedFunction<typeof tokenStore.getAccessToken>;

describe("fetchWithRefresh", () => {
  const serverId = "test-server";
  const baseUrl = "http://localhost:8080";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns data on successful fetch", async () => {
    mockGetAccessToken.mockResolvedValue("valid-token");
    const fetcher = jest.fn().mockResolvedValue({ ok: true, data: { id: 1 } });
    const refresh = jest.fn();

    const result = await fetchWithRefresh(serverId, baseUrl, fetcher, refresh);

    expect(result).toEqual({ ok: true, data: { id: 1 } });
    expect(fetcher).toHaveBeenCalledWith(baseUrl, "valid-token");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns not authenticated when no token is available", async () => {
    mockGetAccessToken.mockResolvedValue(null);
    const fetcher = jest.fn();
    const refresh = jest.fn();

    const result = await fetchWithRefresh(serverId, baseUrl, fetcher, refresh);

    expect(result).toEqual({ ok: false, reason: "Not authenticated." });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refreshes token and retries on TOKEN_EXPIRED", async () => {
    mockGetAccessToken.mockResolvedValueOnce("expired-token").mockResolvedValueOnce("new-token");
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "TOKEN_EXPIRED", message: "Token expired" })
      .mockResolvedValueOnce({ ok: true, data: { id: 2 } });
    const refresh = jest.fn().mockResolvedValue(undefined);

    const result = await fetchWithRefresh(serverId, baseUrl, fetcher, refresh);

    expect(result).toEqual({ ok: true, data: { id: 2 } });
    expect(refresh).toHaveBeenCalledWith(serverId);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(baseUrl, "new-token");
  });

  it("returns session expired when refresh yields no token", async () => {
    mockGetAccessToken.mockResolvedValueOnce("expired-token").mockResolvedValueOnce(null);
    const fetcher = jest.fn().mockResolvedValue({ ok: false, code: "TOKEN_EXPIRED", message: "Token expired" });
    const refresh = jest.fn().mockResolvedValue(undefined);

    const result = await fetchWithRefresh(serverId, baseUrl, fetcher, refresh);

    expect(result).toEqual({ ok: false, reason: "Session expired. Please log in again." });
  });

  it("returns error for non-TOKEN_EXPIRED failures", async () => {
    mockGetAccessToken.mockResolvedValue("valid-token");
    const fetcher = jest.fn().mockResolvedValue({ ok: false, code: "FORBIDDEN", message: "Not allowed" });
    const refresh = jest.fn();

    const result = await fetchWithRefresh(serverId, baseUrl, fetcher, refresh);

    expect(result).toEqual({ ok: false, reason: "Not allowed", code: "FORBIDDEN" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns error when retry also fails after refresh", async () => {
    mockGetAccessToken.mockResolvedValueOnce("expired-token").mockResolvedValueOnce("new-token");
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "TOKEN_EXPIRED", message: "Token expired" })
      .mockResolvedValueOnce({ ok: false, code: "INTERNAL_ERROR", message: "Server error" });
    const refresh = jest.fn().mockResolvedValue(undefined);

    const result = await fetchWithRefresh(serverId, baseUrl, fetcher, refresh);

    expect(result).toEqual({ ok: false, reason: "Server error", code: "INTERNAL_ERROR" });
  });

  it("times out when the fetch cycle stalls", async () => {
    mockGetAccessToken.mockImplementation(() => new Promise(() => {})); // never resolves
    const fetcher = jest.fn();
    const refresh = jest.fn();

    jest.useFakeTimers();
    const promise = fetchWithRefresh(serverId, baseUrl, fetcher, refresh);
    jest.advanceTimersByTime(30_000);

    const result = await promise;
    expect(result).toEqual({ ok: false, reason: "Request timed out." });
    jest.useRealTimers();
  });
});

describe("getValidToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns existing token without refreshing", async () => {
    mockGetAccessToken.mockResolvedValue("valid-token");
    const refresh = jest.fn();

    const token = await getValidToken("server-1", refresh);

    expect(token).toBe("valid-token");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes and returns new token when no token exists", async () => {
    mockGetAccessToken.mockResolvedValueOnce(null).mockResolvedValueOnce("refreshed-token");
    const refresh = jest.fn().mockResolvedValue(undefined);

    const token = await getValidToken("server-1", refresh);

    expect(token).toBe("refreshed-token");
    expect(refresh).toHaveBeenCalledWith("server-1");
  });

  it("returns null when refresh yields no token", async () => {
    mockGetAccessToken.mockResolvedValue(null);
    const refresh = jest.fn().mockResolvedValue(undefined);

    const token = await getValidToken("server-1", refresh);

    expect(token).toBeNull();
  });
});
