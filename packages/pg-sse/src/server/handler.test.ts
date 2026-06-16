import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSseHandler } from "./handler";
import { SseListener } from "./listener";

describe("createSseHandler", () => {
  let mockListener: SseListener;
  let registeredClients: Map<string, (data: string) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    registeredClients = new Map();
    mockListener = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      events: {} as SseListener["events"],
      getActiveConnections: vi.fn().mockReturnValue(5),
      registerClient: vi
        .fn()
        .mockImplementation(
          (clientId: string, send: (data: string) => void) => {
            registeredClients.set(clientId, send);
          },
        ),
      unregisterClient: vi.fn().mockImplementation((clientId: string) => {
        registeredClients.delete(clientId);
      }),
      broadcast: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return a response with correct SSE headers", () => {
    const req = new Request("http://localhost/api/sse");
    const response = createSseHandler(mockListener, req);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe(
      "no-cache, no-transform",
    );
    expect(response.headers.get("Connection")).toBe("keep-alive");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");
  });

  it("should write initial handshake event immediately", async () => {
    const req = new Request("http://localhost/api/sse");
    const response = createSseHandler(mockListener, req);
    const reader = response.body?.getReader();

    expect(reader).toBeDefined();
    if (!reader) return;

    const { value } = await reader.read();
    const message = new TextDecoder().decode(value);

    expect(message).toContain("event: handshake");
    expect(message).toContain('"activeConnections":5');
    expect(mockListener.registerClient).toHaveBeenCalledTimes(1);

    reader.releaseLock();
  });

  it("should unregister client and clear timers when request signal aborts", async () => {
    const abortController = new AbortController();
    const req = new Request("http://localhost/api/sse", {
      signal: abortController.signal,
    });

    const response = createSseHandler(mockListener, req);
    const reader = response.body?.getReader();

    expect(registeredClients.size).toBe(1);
    const clientId = Array.from(registeredClients.keys())[0];

    // Abort the request
    abortController.abort();

    // Trigger timer to run any pending event loops
    vi.advanceTimersByTime(20000);

    // Verify unregisterClient was invoked with the correct clientId
    expect(mockListener.unregisterClient).toHaveBeenCalledWith(clientId);
    expect(registeredClients.size).toBe(0);

    reader?.releaseLock();
  });

  it("should stream keep-alive pings periodically", async () => {
    const req = new Request("http://localhost/api/sse");
    const response = createSseHandler(mockListener, req);
    const reader = response.body?.getReader();

    expect(reader).toBeDefined();
    if (!reader) return;

    // Read handshake
    await reader.read();

    // Fast-forward 20 seconds for the first keep-alive
    const readPromise = reader.read();
    vi.advanceTimersByTime(20000);

    const { value } = await readPromise;
    const message = new TextDecoder().decode(value);

    expect(message).toBe(": keep-alive\n\n");
    reader.releaseLock();
  });
});
