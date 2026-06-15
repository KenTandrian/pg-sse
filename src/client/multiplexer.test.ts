import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TabMultiplexer } from "./multiplexer";

const globalScope = globalThis as unknown as Record<string, unknown>;

class MockBroadcastChannel {
  public static instances: MockBroadcastChannel[] = [];
  public onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public name: string) {
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    // Send message to all other active instances of the same channel name
    MockBroadcastChannel.instances.forEach((instance) => {
      if (
        instance !== this &&
        instance.name === this.name &&
        instance.onmessage
      ) {
        instance.onmessage({ data: message } as MessageEvent);
      }
    });
  }

  close() {
    const idx = MockBroadcastChannel.instances.indexOf(this);
    if (idx !== -1) {
      MockBroadcastChannel.instances.splice(idx, 1);
    }
  }
}

class MockEventSource {
  public static instances: MockEventSource[] = [];
  public listeners: Record<string, Function[]> = {};
  public onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  close() {
    const idx = MockEventSource.instances.indexOf(this);
    if (idx !== -1) {
      MockEventSource.instances.splice(idx, 1);
    }
  }

  trigger(event: string, data: unknown) {
    const list = this.listeners[event] || [];
    list.forEach((cb) => cb({ data: JSON.stringify(data) }));
  }
}

// Bind mocks globally
globalScope.BroadcastChannel = MockBroadcastChannel;
globalScope.EventSource = MockEventSource;
globalScope.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe("TabMultiplexer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.instances = [];
    MockEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should elect a single leader tab and establish EventSource", () => {
    const onEvent = vi.fn();
    const onStatusChange = vi.fn();

    const tabA = new TabMultiplexer("/api/sse", onEvent, onStatusChange);

    // Fast forward to complete election window (1500ms watchdog + 500ms election wait)
    vi.advanceTimersByTime(2000);

    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toBe("/api/sse");

    tabA.destroy();
  });

  it("should not connect sibling tabs to EventSource if a leader is active", () => {
    const onEvent = vi.fn();
    const onStatusChange = vi.fn();

    // Tab A starts and becomes leader
    const tabA = new TabMultiplexer("/api/sse", onEvent, onStatusChange);
    vi.advanceTimersByTime(2000);
    expect(MockEventSource.instances.length).toBe(1);

    // Tab B starts
    const tabB = new TabMultiplexer("/api/sse", onEvent, onStatusChange);
    vi.advanceTimersByTime(2000);

    // EventSource instances count should still be 1 (only Tab A has a connection)
    expect(MockEventSource.instances.length).toBe(1);

    tabA.destroy();
    tabB.destroy();
  });

  it("should forward EventSource notifications from leader to follower tabs", () => {
    const onEventA = vi.fn();
    const onStatusA = vi.fn();
    const onEventB = vi.fn();
    const onStatusB = vi.fn();

    const tabA = new TabMultiplexer("/api/sse", onEventA, onStatusA);
    vi.advanceTimersByTime(2000);

    const tabB = new TabMultiplexer("/api/sse", onEventB, onStatusB);
    vi.advanceTimersByTime(2000);

    // Simulate database event arriving at Tab A's EventSource
    const mockData = { table: "users", action: "UPDATE", id: 42 };
    MockEventSource.instances[0].trigger("notification", mockData);

    // Both tabs should receive the event
    expect(onEventA).toHaveBeenCalledWith("notification", mockData);
    expect(onEventB).toHaveBeenCalledWith("notification", mockData);

    tabA.destroy();
    tabB.destroy();
  });

  it("should transfer leadership and connect sibling when leader is destroyed", () => {
    const onEventA = vi.fn();
    const onStatusA = vi.fn();
    const onEventB = vi.fn();
    const onStatusB = vi.fn();

    const tabA = new TabMultiplexer("/api/sse", onEventA, onStatusA);
    vi.advanceTimersByTime(2000);
    expect(MockEventSource.instances.length).toBe(1);

    const tabB = new TabMultiplexer("/api/sse", onEventB, onStatusB);
    vi.advanceTimersByTime(2000);

    // Destroy leader Tab A
    tabA.destroy();

    // Fast-forward to trigger B election (Tab B notices leadership release and claims it)
    vi.advanceTimersByTime(1000);

    // Tab B should have opened a new EventSource connection
    expect(MockEventSource.instances.length).toBe(1);

    tabB.destroy();
  });
});
