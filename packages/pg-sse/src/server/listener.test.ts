import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { PostgresSseListener } from "./listener";

const globalScope = globalThis as unknown as Record<string, unknown>;

interface MockClientInstance {
  emitEvent(event: string, payload: unknown): void;
}

vi.mock("pg", () => {
  const mockConnect = vi.fn();
  const mockQuery = vi.fn();
  const mockEnd = vi.fn();

  const localGlobalScope = globalThis as unknown as Record<string, unknown>;
  localGlobalScope.__mockClientConnect = mockConnect;
  localGlobalScope.__mockClientQuery = mockQuery;
  localGlobalScope.__mockClientEnd = mockEnd;

  class MockClient {
    public listeners: Record<string, Function[]> = {};
    public config: unknown;

    constructor(config: unknown) {
      this.config = config;
      localGlobalScope.__activeMockClient = this;
    }

    connect = mockConnect;
    query = mockQuery;
    end = mockEnd;

    on(event: string, callback: Function) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }

    emitEvent(event: string, payload: unknown) {
      const list = this.listeners[event] || [];
      list.forEach((cb) => cb(payload));
    }
  }

  return {
    Client: MockClient,
  };
});

// Helper functions to get mocks in tests
const getConnectMock = () => globalScope.__mockClientConnect as Mock;
const getQueryMock = () => globalScope.__mockClientQuery as Mock;
const getEndMock = () => globalScope.__mockClientEnd as Mock;
const getActiveClient = () =>
  globalScope.__activeMockClient as MockClientInstance;

describe("PostgresSseListener", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getConnectMock().mockResolvedValue(undefined);
    getQueryMock().mockResolvedValue(undefined);
    getEndMock().mockResolvedValue(undefined);
    vi.useFakeTimers();
    globalScope.__activeMockClient = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should throw error if channel name is invalid (SQL Injection Prevention)", () => {
    expect(
      () => new PostgresSseListener("postgres://localhost", "valid_name"),
    ).not.toThrow();
    expect(
      () => new PostgresSseListener("postgres://localhost", "invalid-name"),
    ).toThrow();
    expect(
      () =>
        new PostgresSseListener(
          "postgres://localhost",
          "invalid; DROP TABLE users;",
        ),
    ).toThrow();
  });

  it("should connect, listen to channels, and emit connected event", async () => {
    const listener = new PostgresSseListener("postgres://localhost", [
      "ch1",
      "ch2",
    ]);
    const connectedSpy = vi.fn();
    listener.events.on("connected", connectedSpy);

    const connectPromise = listener.connect();
    await connectPromise;

    expect(getConnectMock()).toHaveBeenCalledTimes(1);
    expect(getQueryMock()).toHaveBeenCalledTimes(2);
    expect(getQueryMock()).toHaveBeenNthCalledWith(1, "LISTEN ch1");
    expect(getQueryMock()).toHaveBeenNthCalledWith(2, "LISTEN ch2");
    expect(connectedSpy).toHaveBeenCalledTimes(1);
  });

  it("should parse notification JSON payload and emit parsed structure", async () => {
    const listener = new PostgresSseListener("postgres://localhost", "events");
    const notificationSpy = vi.fn();
    listener.events.on("notification", notificationSpy);

    await listener.connect();

    expect(getActiveClient()).not.toBeNull();

    // Simulate PG notification
    const payload = JSON.stringify({
      table: "users",
      action: "INSERT",
      id: 101,
      username: "ken",
    });
    getActiveClient().emitEvent("notification", { channel: "events", payload });

    expect(notificationSpy).toHaveBeenCalledTimes(1);
    expect(notificationSpy).toHaveBeenCalledWith({
      table: "users",
      action: "INSERT",
      id: 101,
      username: "ken",
    });
  });

  it("should fall back to raw string if notification payload is not JSON", async () => {
    const listener = new PostgresSseListener("postgres://localhost", "events");
    const notificationSpy = vi.fn();
    listener.events.on("notification", notificationSpy);

    await listener.connect();

    getActiveClient().emitEvent("notification", {
      channel: "events",
      payload: "plain-text-message",
    });

    expect(notificationSpy).toHaveBeenCalledTimes(1);
    expect(notificationSpy).toHaveBeenCalledWith({
      table: "unknown",
      action: "INSERT",
      id: "",
      data: "plain-text-message",
    });
  });

  it("should schedule reconnect with exponential backoff on client error", async () => {
    const listener = new PostgresSseListener("postgres://localhost", "events");
    const reconnectSpy = vi.fn();
    const errorSpy = vi.fn();

    listener.events.on("reconnect", reconnectSpy);
    listener.events.on("error", errorSpy);

    // Initial connection
    await listener.connect();
    expect(getConnectMock()).toHaveBeenCalledTimes(1);

    // Simulate PG Error (e.g. database restart)
    const mockError = new Error("Connection lost");
    getActiveClient().emitEvent("error", mockError);

    expect(errorSpy).toHaveBeenCalledWith(mockError);
    expect(getEndMock()).toHaveBeenCalledTimes(1); // Cleans up failed client
    expect(reconnectSpy).toHaveBeenCalledWith(1); // First reconnect attempt triggered

    // Fast-forward timers to fire the reconnect loop (exponential backoff starts at 1000ms + random jitter up to 1000ms)
    vi.advanceTimersByTime(3000);

    // Verify it attempts to connect again
    expect(getConnectMock()).toHaveBeenCalledTimes(2);
  });
});
