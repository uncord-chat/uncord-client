/**
 * Tests for the token store web (localStorage) path.
 *
 * The default jest-expo environment sets Platform.OS to "ios", so we need to
 * mock Platform to return "web" to exercise the localStorage code path.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// ---------------------------------------------------------------------------
// Mock Platform before any module imports
// ---------------------------------------------------------------------------

jest.mock("react-native", () => {
  const actual: Record<string, unknown> = {
    Platform: { OS: "web", select: (obj: Record<string, unknown>) => obj.web ?? obj.default },
    StyleSheet: { create: (styles: unknown) => styles },
  };
  return { __esModule: true, ...actual };
});

// Mock SecureStore to verify it is NOT used on web
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// ---------------------------------------------------------------------------
// In-memory localStorage mock
// ---------------------------------------------------------------------------

const store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: jest.fn((key: string) => store[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete store[key];
  }),
};

Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true });

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import * as SecureStore from "expo-secure-store";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/token-store";

describe("token-store (web path)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(store)) delete store[key];
  });

  describe("getAccessToken", () => {
    it("reads access token from localStorage", async () => {
      store["uncord_tokens_server-1_access"] = "web-access-token";
      const token = await getAccessToken("server-1");
      expect(token).toBe("web-access-token");
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it("returns null when no token is stored", async () => {
      const token = await getAccessToken("server-1");
      expect(token).toBeNull();
    });
  });

  describe("getRefreshToken", () => {
    it("reads refresh token from localStorage", async () => {
      store["uncord_tokens_server-1_refresh"] = "web-refresh-token";
      const token = await getRefreshToken("server-1");
      expect(token).toBe("web-refresh-token");
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    });
  });

  describe("setTokens", () => {
    it("stores both tokens in localStorage", async () => {
      await setTokens("server-1", "access-123", "refresh-456");
      expect(store["uncord_tokens_server-1_access"]).toBe("access-123");
      expect(store["uncord_tokens_server-1_refresh"]).toBe("refresh-456");
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });

  describe("clearTokens", () => {
    it("removes both tokens from localStorage", async () => {
      store["uncord_tokens_server-1_access"] = "access-123";
      store["uncord_tokens_server-1_refresh"] = "refresh-456";
      await clearTokens("server-1");
      expect(store["uncord_tokens_server-1_access"]).toBeUndefined();
      expect(store["uncord_tokens_server-1_refresh"]).toBeUndefined();
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });
  });

  describe("key isolation", () => {
    it("uses different keys for different servers", async () => {
      store["uncord_tokens_server-a_access"] = "token-a";
      store["uncord_tokens_server-b_access"] = "token-b";
      expect(await getAccessToken("server-a")).toBe("token-a");
      expect(await getAccessToken("server-b")).toBe("token-b");
    });
  });

  describe("error handling", () => {
    it("returns null when localStorage.getItem throws", async () => {
      mockLocalStorage.getItem.mockImplementationOnce(() => {
        throw new Error("Private browsing");
      });
      const token = await getAccessToken("server-1");
      expect(token).toBeNull();
    });

    it("does not throw when localStorage.setItem throws", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error("Quota exceeded");
      });
      await expect(setTokens("server-1", "a", "r")).resolves.toBeUndefined();
      warnSpy.mockRestore();
    });

    it("does not throw when localStorage.removeItem throws", async () => {
      mockLocalStorage.removeItem.mockImplementationOnce(() => {
        throw new Error("Error");
      });
      await expect(clearTokens("server-1")).resolves.toBeUndefined();
    });
  });
});
