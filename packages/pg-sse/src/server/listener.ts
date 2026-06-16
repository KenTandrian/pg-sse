import { Client, ClientConfig } from "pg";
import { TypedEmitter } from "../shared/emitter";

export interface SseListenerEvents {
  connected: void;
  error: Error;
  reconnect: number;
  notification: {
    table: string;
    action: "INSERT" | "UPDATE" | "DELETE";
    id: string | number;
    [key: string]: unknown;
  };
}

export interface SseListener {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  events: TypedEmitter<SseListenerEvents>;
  getActiveConnections(): number;
  registerClient(clientId: string, send: (data: string) => void): void;
  unregisterClient(clientId: string): void;
  broadcast(event: string, data: unknown): void;
}

export class PostgresSseListener implements SseListener {
  public events = new TypedEmitter<SseListenerEvents>();
  private client: Client | null = null;
  private isConnected = false;
  private isDisconnecting = false;
  private retryCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // In-memory registry of active SSE clients
  private clients = new Map<string, (data: string) => void>();

  private readonly config: ClientConfig | string;
  private readonly channels: string[];

  constructor(
    config: ClientConfig | string,
    channels: string | string[] = "pg_sse_events",
  ) {
    this.config = config;
    this.channels = Array.isArray(channels) ? channels : [channels];

    // Security validation of channel names to prevent SQL injection via LISTEN
    const channelRegex = /^[a-zA-Z0-9_]+$/;
    for (const channel of this.channels) {
      if (!channelRegex.test(channel)) {
        throw new Error(
          `Invalid channel name: "${channel}". Channel names must be alphanumeric and underscores only.`,
        );
      }
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;
    this.isDisconnecting = false;

    try {
      this.client =
        typeof this.config === "string"
          ? new Client(this.config)
          : new Client(this.config);

      this.client.on("error", (err) => {
        this.handleConnectionError(err);
      });

      this.client.on("notification", (msg) => {
        this.handleNotification(msg);
      });

      await this.client.connect();

      for (const channel of this.channels) {
        // Safe because of strict regex validation in constructor
        await this.client.query(`LISTEN ${channel}`);
      }

      this.isConnected = true;
      this.retryCount = 0;
      this.events.emit("connected", undefined);
    } catch (err) {
      this.handleConnectionError(err as Error);
    }
  }

  public async disconnect(): Promise<void> {
    this.isDisconnecting = true;
    this.isConnected = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.client.end();
      } catch (err) {
        // Ignore errors during clean disconnect
      } finally {
        this.client = null;
      }
    }
  }

  public getActiveConnections(): number {
    return this.clients.size;
  }

  public registerClient(clientId: string, send: (data: string) => void): void {
    this.clients.set(clientId, send);
  }

  public unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  public broadcast(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const send of this.clients.values()) {
      try {
        send(message);
      } catch (err) {
        // Client stream might be closed/broken
      }
    }
  }

  private handleConnectionError(err: Error) {
    if (this.isDisconnecting) return;

    this.isConnected = false;
    this.events.emit("error", err);

    if (this.client) {
      this.client.end().catch(() => {});
      this.client = null;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.retryCount++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
    // Add jitter: up to 1000ms
    const jitter = Math.random() * 1000;
    const finalDelay = delay + jitter;

    this.events.emit("reconnect", this.retryCount);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (err) {
        // Error will trigger handleConnectionError which calls scheduleReconnect again
      }
    }, finalDelay);
  }

  private handleNotification(msg: { channel: string; payload?: string }) {
    if (!msg.payload) return;

    try {
      let parsedPayload: unknown;
      try {
        parsedPayload = JSON.parse(msg.payload);
      } catch (e) {
        parsedPayload = msg.payload; // Fallback to raw string
      }

      // Check if the payload matches the expected structure, or wrap it
      const isObjectPayload =
        typeof parsedPayload === "object" && parsedPayload !== null;
      const payloadObj = isObjectPayload
        ? (parsedPayload as Record<string, unknown>)
        : null;

      const eventPayload = payloadObj
        ? {
            table: (payloadObj.table as string) || "unknown",
            action:
              (payloadObj.action as "INSERT" | "UPDATE" | "DELETE") || "INSERT",
            id:
              payloadObj.id !== undefined
                ? (payloadObj.id as string | number)
                : "",
            ...payloadObj,
          }
        : {
            table: "unknown",
            action: "INSERT" as const,
            id: "",
            data: parsedPayload,
          };

      // Emit typed event
      this.events.emit("notification", eventPayload);

      // Broadcast to all active client SSE streams
      this.broadcast("notification", eventPayload);
    } catch (err) {
      // Avoid throwing unhandled exception inside event loop
      this.events.emit(
        "error",
        new Error(
          `Failed to process notification payload: ${(err as Error).message}`,
        ),
      );
    }
  }
}
