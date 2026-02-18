/**
 * Tests for the token store. In the test environment Platform.OS is "ios"
 * by default (via jest-expo), so we test the SecureStore (native) path.
 * The web path uses localStorage, which is a simple wrapper with try/catch.
 */

import * as SecureStore from "expo-secure-store";

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/token-store";

jest.mock("expo-secure-store");

const mockGet = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSet = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const mockDelete = SecureStore.deleteItemAsync as jest.MockedFunction<typeof SecureStore.deleteItemAsync>;

describe("token-store (native path)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAccessToken", () => {
    it("reads access token from SecureStore", async () => {
      mockGet.mockResolvedValue("my-access-token");
      const token = await getAccessToken("server-1");
      expect(token).toBe("my-access-token");
      expect(mockGet).toHaveBeenCalledWith("uncord_tokens_server-1_access");
    });

    it("returns null when no token is stored", async () => {
      mockGet.mockResolvedValue(null);
      const token = await getAccessToken("server-1");
      expect(token).toBeNull();
    });
  });

  describe("getRefreshToken", () => {
    it("reads refresh token from SecureStore", async () => {
      mockGet.mockResolvedValue("my-refresh-token");
      const token = await getRefreshToken("server-1");
      expect(token).toBe("my-refresh-token");
      expect(mockGet).toHaveBeenCalledWith("uncord_tokens_server-1_refresh");
    });
  });

  describe("setTokens", () => {
    it("stores both tokens in SecureStore", async () => {
      mockSet.mockResolvedValue(undefined);
      await setTokens("server-1", "access-123", "refresh-456");
      expect(mockSet).toHaveBeenCalledWith("uncord_tokens_server-1_access", "access-123");
      expect(mockSet).toHaveBeenCalledWith("uncord_tokens_server-1_refresh", "refresh-456");
    });
  });

  describe("clearTokens", () => {
    it("deletes both tokens from SecureStore", async () => {
      mockDelete.mockResolvedValue(undefined);
      await clearTokens("server-1");
      expect(mockDelete).toHaveBeenCalledWith("uncord_tokens_server-1_access");
      expect(mockDelete).toHaveBeenCalledWith("uncord_tokens_server-1_refresh");
    });
  });

  describe("key isolation", () => {
    it("uses different keys for different servers", async () => {
      mockGet.mockResolvedValue(null);
      await getAccessToken("server-a");
      await getAccessToken("server-b");
      expect(mockGet).toHaveBeenCalledWith("uncord_tokens_server-a_access");
      expect(mockGet).toHaveBeenCalledWith("uncord_tokens_server-b_access");
    });
  });
});
