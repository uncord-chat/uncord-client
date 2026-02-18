import AsyncStorage from "@react-native-async-storage/async-storage";

import { addServer, getServers, removeServer, serverIdFromBaseUrl, updateServerName } from "@/lib/servers/server-store";

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        for (const key of Object.keys(store)) delete store[key];
        return Promise.resolve();
      }),
    },
  };
});

describe("serverIdFromBaseUrl", () => {
  it("normalises a simple URL", () => {
    const id = serverIdFromBaseUrl("http://localhost:8080");
    expect(id).toBe("http://localhost:8080");
  });

  it("strips trailing slashes", () => {
    const id = serverIdFromBaseUrl("http://localhost:8080///");
    expect(id).toBe("http://localhost:8080");
  });

  it("normalises URLs with paths", () => {
    const id = serverIdFromBaseUrl("https://example.com/api");
    expect(id).toBe("https://example.com/api");
  });

  it("produces consistent ids for the same URL", () => {
    const a = serverIdFromBaseUrl("http://localhost:8080/");
    const b = serverIdFromBaseUrl("http://localhost:8080");
    expect(a).toBe(b);
  });
});

describe("server store", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns empty array when no servers stored", async () => {
    const servers = await getServers();
    expect(servers).toEqual([]);
  });

  it("adds and retrieves a server", async () => {
    const server = await addServer("http://localhost:8080", "Test Server");
    expect(server.baseUrl).toBe("http://localhost:8080");
    expect(server.name).toBe("Test Server");

    const servers = await getServers();
    expect(servers).toHaveLength(1);
    expect(servers[0]!.id).toBe(server.id);
  });

  it("does not duplicate when adding the same URL twice", async () => {
    await addServer("http://localhost:8080", "First");
    await addServer("http://localhost:8080", "Second");

    const servers = await getServers();
    expect(servers).toHaveLength(1);
    expect(servers[0]!.name).toBe("Second");
  });

  it("updates a server name", async () => {
    const server = await addServer("http://localhost:8080", "Old Name");
    await updateServerName(server.id, "New Name");

    const servers = await getServers();
    expect(servers[0]!.name).toBe("New Name");
  });

  it("removes a server", async () => {
    const server = await addServer("http://localhost:8080", "Test");
    await removeServer(server.id);

    const servers = await getServers();
    expect(servers).toHaveLength(0);
  });

  it("handles removing a non-existent server gracefully", async () => {
    await addServer("http://localhost:8080");
    await removeServer("non-existent-id");

    const servers = await getServers();
    expect(servers).toHaveLength(1);
  });

  it("handles corrupt storage data gracefully", async () => {
    await AsyncStorage.setItem("uncord_servers", "not-json{{{");
    const servers = await getServers();
    expect(servers).toEqual([]);
  });

  it("handles non-array storage data gracefully", async () => {
    await AsyncStorage.setItem("uncord_servers", JSON.stringify({ notAnArray: true }));
    const servers = await getServers();
    expect(servers).toEqual([]);
  });

  it("filters out malformed entries", async () => {
    await AsyncStorage.setItem(
      "uncord_servers",
      JSON.stringify([
        { id: "valid", baseUrl: "http://localhost" },
        { id: 123, baseUrl: "missing-string-id" },
        { baseUrl: "no-id" },
        null,
      ]),
    );
    const servers = await getServers();
    expect(servers).toHaveLength(1);
    expect(servers[0]!.id).toBe("valid");
  });
});
