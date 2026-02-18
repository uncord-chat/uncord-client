import type { DispatchEvent } from "@uncord-chat/protocol/events/dispatch";
import type { Frame } from "@uncord-chat/protocol/events/frame";
import type { Opcode } from "@uncord-chat/protocol/events/opcodes";
import type { HelloData } from "@uncord-chat/protocol/models/gateway";

type EventHandler = (data: unknown) => void;
type PseudoEvent = "open" | "close";
type ListenerKey = DispatchEvent | PseudoEvent;

// ---------------------------------------------------------------------------
// Type guards for gateway payloads
// ---------------------------------------------------------------------------

function isHelloData(d: unknown): d is HelloData {
  return (
    typeof d === "object" &&
    d !== null &&
    "heartbeat_interval" in d &&
    typeof (d as HelloData).heartbeat_interval === "number"
  );
}

function isReadyData(d: unknown): d is { session_id?: string } {
  return typeof d === "object" && d !== null;
}

function isFrame(d: unknown): d is Frame {
  return typeof d === "object" && d !== null && "op" in d && typeof (d as Frame).op === "number";
}

// Gateway opcodes — must match @uncord-chat/protocol/events/opcodes.
// Inlined because Metro cannot resolve runtime (value) imports from the
// symlinked protocol package; only type imports work across the symlink.
const OP_DISPATCH: Opcode = 0;
const OP_HEARTBEAT: Opcode = 1;
const OP_IDENTIFY: Opcode = 2;
const OP_PRESENCE_UPDATE: Opcode = 3;
const OP_RESUME: Opcode = 6;
const OP_RECONNECT: Opcode = 7;
const OP_INVALID_SESSION: Opcode = 9;
const OP_HELLO: Opcode = 10;
const OP_HEARTBEAT_ACK: Opcode = 11;

/**
 * Close codes defined by the uncord gateway protocol.
 * 4004 = InvalidToken — the token sent during Identify/Resume was rejected.
 * 4008 = RateLimited.
 */
const CLOSE_INVALID_TOKEN = 4004;
const CLOSE_RATE_LIMITED = 4008;

const MAX_BACKOFF_MS = 30_000;
const RATE_LIMIT_WAIT_MS = 60_000;

function deriveWsUrl(baseUrl: string): string {
  const url = baseUrl.replace(/\/+$/, "");
  const wsUrl = url.replace(/^http/, "ws");
  return `${wsUrl}/api/v1/gateway`;
}

/**
 * Core WebSocket client for the uncord gateway protocol.
 *
 * Handles the full lifecycle: Hello → Identify/Resume → dispatch events,
 * heartbeat loop, and reconnection with exponential backoff.
 */
export class GatewayClient {
  private readonly baseUrl: string;
  private readonly getToken: () => Promise<string | null>;

  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatAckReceived = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;

  private sessionId: string | null = null;
  private seq: number | null = null;
  private intentionalClose = false;
  private disposed = false;

  private listeners = new Map<string, Set<EventHandler>>();

  constructor(baseUrl: string, getToken: () => Promise<string | null>) {
    this.baseUrl = baseUrl;
    this.getToken = getToken;
  }

  /** Open a WebSocket connection to the gateway. */
  connect(): void {
    if (this.disposed) return;
    this.intentionalClose = false;
    this.clearReconnectTimer();

    // Tear down any lingering previous socket before opening a new one.
    if (this.ws) {
      this.cleanup();
      try {
        this.ws.close(1000);
      } catch {
        // Already closed — ignore.
      }
      this.ws = null;
    }

    const url = deriveWsUrl(this.baseUrl);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data as string);
    };

    ws.onclose = (event: CloseEvent) => {
      this.cleanup();

      // If this socket was superseded by a newer one, or the client was
      // disposed, suppress further action to prevent reconnect storms.
      if (this.disposed || ws !== this.ws) return;

      this.emit("close", { code: event.code, reason: event.reason });

      if (this.intentionalClose) return;

      if (event.code === CLOSE_INVALID_TOKEN) {
        // Token was rejected — clear session so next connect does fresh Identify.
        this.sessionId = null;
        this.seq = null;
        this.scheduleReconnect();
      } else if (event.code === CLOSE_RATE_LIMITED) {
        this.scheduleReconnect(RATE_LIMIT_WAIT_MS);
      } else {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // The close handler will fire after this; nothing extra needed.
    };
  }

  /** Send a presence status update to the gateway. */
  sendPresenceUpdate(status: string): void {
    this.send({ op: OP_PRESENCE_UPDATE, d: { status } });
  }

  /** Cleanly close the connection. No automatic reconnect. */
  disconnect(): void {
    this.disposed = true;
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
  }

  /**
   * Subscribe to a dispatch event (or "open"/"close" pseudo-events).
   * Returns an unsubscribe function.
   */
  on(event: ListenerKey, handler: EventHandler): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.listeners.delete(event);
    };
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private handleMessage(raw: string): void {
    if (this.disposed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.warn("[Gateway] Failed to parse message:", err);
      return;
    }
    if (!isFrame(parsed)) return;
    const frame = parsed;

    switch (frame.op) {
      case OP_HELLO:
        if (isHelloData(frame.d)) {
          this.handleHello(frame.d);
        }
        break;

      case OP_DISPATCH:
        this.handleDispatch(frame);
        break;

      case OP_HEARTBEAT_ACK:
        this.heartbeatAckReceived = true;
        break;

      case OP_RECONNECT:
        // Server requests we reconnect immediately.
        this.ws?.close(4000);
        break;

      case OP_INVALID_SESSION: {
        const resumable = frame.d as boolean;
        if (!resumable) {
          // Cannot resume — clear session so next connect does a fresh Identify.
          this.sessionId = null;
          this.seq = null;
        }
        // Reconnect (will attempt Resume if resumable, Identify otherwise).
        this.ws?.close(4000);
        break;
      }
    }
  }

  private async handleHello(data: HelloData): Promise<void> {
    const token = await this.getToken();
    // Re-check disposed after the async gap — the client may have been torn
    // down while we were awaiting the token.
    if (this.disposed) return;

    // Start heartbeat only after confirming the client is still alive,
    // preventing zombie heartbeat timers on a disposed client.
    this.startHeartbeat(data.heartbeat_interval);
    if (!token) {
      // No valid token available — close without reconnecting to avoid an
      // infinite loop of connect → no token → idle → server close → reconnect.
      this.intentionalClose = true;
      this.ws?.close(4000);
      return;
    }

    if (this.sessionId && this.seq !== null) {
      // Attempt Resume.
      this.send({
        op: OP_RESUME,
        d: { token, session_id: this.sessionId, seq: this.seq },
      });
    } else {
      // Fresh Identify.
      this.send({ op: OP_IDENTIFY, d: { token } });
    }
  }

  private handleDispatch(frame: Frame): void {
    if (frame.s != null) {
      this.seq = frame.s;
    }

    if (frame.t === "READY" && isReadyData(frame.d)) {
      if (frame.d.session_id) {
        this.sessionId = frame.d.session_id;
      }
      this.emit("open", frame.d);
    }

    if (frame.t) {
      this.emit(frame.t, frame.d);
    }
  }

  private startHeartbeat(intervalMs: number): void {
    this.stopHeartbeat();
    this.heartbeatAckReceived = true;

    this.heartbeatTimer = setInterval(() => {
      if (!this.heartbeatAckReceived) {
        // Missed ACK — connection is zombie. Force close to trigger reconnect.
        this.ws?.close(4000);
        return;
      }
      this.heartbeatAckReceived = false;
      this.send({ op: OP_HEARTBEAT });
    }, intervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private send(frame: Partial<Frame>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private emit(event: string, data: unknown): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const handler of set) {
        handler(data);
      }
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
    }
  }

  private scheduleReconnect(delayMs?: number): void {
    if (this.disposed) return;
    this.clearReconnectTimer();

    const base = delayMs ?? Math.min(1000 * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    // Full jitter: delay in range [base * 0.5, base * 1.5] for better decorrelation.
    const jitter = (Math.random() - 0.5) * base;
    const backoff = Math.round(base + jitter);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, backoff);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
