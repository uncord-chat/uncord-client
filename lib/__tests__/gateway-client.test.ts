import { GatewayClient } from "@/lib/gateway/gateway-client";

// ---------------------------------------------------------------------------
// Minimal WebSocket mock
// ---------------------------------------------------------------------------

type WSHandler = ((event: unknown) => void) | null;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: WSHandler = null;
  onmessage: WSHandler = null;
  onclose: WSHandler = null;
  onerror: WSHandler = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async open
    setTimeout(() => this.onopen?.({ type: "open" }), 0);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000): void {
    this.readyState = MockWebSocket.CLOSED;
    setTimeout(() => this.onclose?.({ code, reason: "" }), 0);
  }

  // Test helpers
  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateClose(code: number, reason = ""): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
}

// Replace global WebSocket
(globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocket;

// Expose static OPEN/CLOSED so gateway-client can reference WebSocket.OPEN
Object.defineProperty(MockWebSocket, "OPEN", { value: 1 });
Object.defineProperty(MockWebSocket, "CLOSED", { value: 3 });

describe("GatewayClient", () => {
  let getToken: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    MockWebSocket.instances = [];
    getToken = jest.fn().mockResolvedValue("test-token");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("constructs without connecting", () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    expect(MockWebSocket.instances).toHaveLength(0);
    client.disconnect();
  });

  it("connects and creates a WebSocket with correct URL", () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]!.url).toBe("ws://localhost:8080/api/v1/gateway");
    client.disconnect();
  });

  it("converts https to wss", () => {
    const client = new GatewayClient("https://example.com", getToken);
    client.connect();
    expect(MockWebSocket.instances[0]!.url).toBe("wss://example.com/api/v1/gateway");
    client.disconnect();
  });

  it("sends Identify after receiving Hello", async () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const ws = MockWebSocket.instances[0]!;
    ws.simulateMessage({ op: 10, d: { heartbeat_interval: 30000 } });

    // Wait for async getToken
    await Promise.resolve();
    await Promise.resolve();

    const sent = ws.sent.map((s) => JSON.parse(s));
    const identify = sent.find((f) => f.op === 2);
    expect(identify).toBeDefined();
    expect(identify.d.token).toBe("test-token");
    client.disconnect();
  });

  it("sends Resume when session_id exists", async () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const ws = MockWebSocket.instances[0]!;
    // Send Hello
    ws.simulateMessage({ op: 10, d: { heartbeat_interval: 30000 } });
    await Promise.resolve();
    await Promise.resolve();

    // Send READY with session_id and a sequence number
    ws.simulateMessage({ op: 0, t: "READY", s: 1, d: { session_id: "sess-123" } });

    // Simulate reconnect — close and reconnect
    ws.sent.length = 0;
    ws.simulateMessage({ op: 10, d: { heartbeat_interval: 30000 } });
    await Promise.resolve();
    await Promise.resolve();

    const sent = ws.sent.map((s) => JSON.parse(s));
    const resume = sent.find((f) => f.op === 6);
    expect(resume).toBeDefined();
    expect(resume.d.session_id).toBe("sess-123");
    expect(resume.d.seq).toBe(1);
    client.disconnect();
  });

  it("emits dispatch events to listeners", () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const handler = jest.fn();
    client.on("MESSAGE_CREATE", handler);

    const ws = MockWebSocket.instances[0]!;
    ws.simulateMessage({ op: 0, t: "MESSAGE_CREATE", s: 1, d: { content: "hello" } });

    expect(handler).toHaveBeenCalledWith({ content: "hello" });
    client.disconnect();
  });

  it("unsubscribes listeners via returned function", () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const handler = jest.fn();
    const unsub = client.on("MESSAGE_CREATE", handler);
    unsub();

    const ws = MockWebSocket.instances[0]!;
    ws.simulateMessage({ op: 0, t: "MESSAGE_CREATE", s: 1, d: { content: "hello" } });

    expect(handler).not.toHaveBeenCalled();
    client.disconnect();
  });

  it("emits close event with code", () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const handler = jest.fn();
    client.on("close", handler);

    const ws = MockWebSocket.instances[0]!;
    ws.simulateClose(1000);

    expect(handler).toHaveBeenCalledWith({ code: 1000, reason: "" });
    client.disconnect();
  });

  it("does not reconnect after intentional disconnect", () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();
    client.disconnect();

    jest.advanceTimersByTime(60000);
    // Only the initial connection should exist
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("handles heartbeat ACK correctly", async () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const ws = MockWebSocket.instances[0]!;
    ws.simulateMessage({ op: 10, d: { heartbeat_interval: 1000 } });
    await Promise.resolve();
    await Promise.resolve();

    // Advance past heartbeat interval
    jest.advanceTimersByTime(1000);
    const heartbeat = ws.sent.find((s) => JSON.parse(s).op === 1);
    expect(heartbeat).toBeDefined();

    // ACK it
    ws.simulateMessage({ op: 11 });

    // Next heartbeat should work
    jest.advanceTimersByTime(1000);
    client.disconnect();
  });

  it("closes on missed heartbeat ACK (zombie connection)", async () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const ws = MockWebSocket.instances[0]!;
    const closeSpy = jest.spyOn(ws, "close");

    ws.simulateMessage({ op: 10, d: { heartbeat_interval: 1000 } });
    await Promise.resolve();
    await Promise.resolve();

    // First heartbeat sent
    jest.advanceTimersByTime(1000);

    // Don't ACK — next heartbeat should trigger close
    jest.advanceTimersByTime(1000);
    expect(closeSpy).toHaveBeenCalledWith(4000);
    client.disconnect();
  });

  it("sends presence update", () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const ws = MockWebSocket.instances[0]!;
    client.sendPresenceUpdate("online");

    const sent = ws.sent.map((s) => JSON.parse(s));
    expect(sent).toContainEqual({ op: 3, d: { status: "online" } });
    client.disconnect();
  });

  it("does not connect after disposal", () => {
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.disconnect(); // dispose before connect
    client.connect();
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("warns on malformed JSON messages", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    const client = new GatewayClient("http://localhost:8080", getToken);
    client.connect();

    const ws = MockWebSocket.instances[0]!;
    ws.onmessage?.({ data: "not-json{{{" } as unknown as MessageEvent);

    expect(warnSpy).toHaveBeenCalledWith("[Gateway] Failed to parse message:", expect.any(SyntaxError));
    warnSpy.mockRestore();
    client.disconnect();
  });
});
