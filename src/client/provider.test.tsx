import { useContext, useState, useRef, useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { SseProvider, useSubscription } from "./provider";

// Mock React module hook exports directly
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useContext: vi.fn(),
    useRef: vi.fn(),
    useState: vi.fn(),
    useEffect: vi.fn(),
    useCallback: vi.fn().mockImplementation((fn) => fn),
  };
});

vi.mock("./multiplexer", () => {
  class MockTabMultiplexer {
    constructor(
      public endpoint: string,
      public onEvent: (event: string, payload: unknown) => void,
      public onStatusChange: (
        status: string,
        activeConnections: number,
      ) => void,
    ) {
      (globalThis as unknown as Record<string, unknown>).__latestMultiplexer =
        this;
    }
    destroy = vi.fn();
  }
  return {
    TabMultiplexer: MockTabMultiplexer,
  };
});

const getLatestMultiplexer = () =>
  (globalThis as unknown as Record<string, unknown>).__latestMultiplexer as
    | {
        onEvent: (event: string, payload: unknown) => void;
        onStatusChange: (status: string, activeConnections: number) => void;
        destroy: Mock;
      }
    | undefined;

describe("SseProvider and useSubscription (Unit Tests)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useSubscription", () => {
    it("should subscribe with table name and trigger callback on payload receive", () => {
      const subscribeMock = vi
        .fn()
        .mockImplementation((table: string, cb: (payload: unknown) => void) => {
          cb({ id: 101, val: "hello" });
          return vi.fn(); // Unsubscribe mock
        });

      // Configure mocked react hooks
      (useContext as Mock).mockReturnValue({ subscribe: subscribeMock });
      (useRef as Mock).mockReturnValue({ current: null });
      (useEffect as Mock).mockImplementation((effect) => effect());

      const callbackSpy = vi.fn();
      useSubscription("orders", callbackSpy);

      expect(useContext).toHaveBeenCalled();
      expect(subscribeMock).toHaveBeenCalledWith(
        "orders",
        expect.any(Function),
      );
      expect(callbackSpy).toHaveBeenCalledTimes(1);
      expect(callbackSpy).toHaveBeenCalledWith({ id: 101, val: "hello" });
    });
  });

  describe("SseProvider context construction", () => {
    it("should initialize component state and callbacks successfully", () => {
      let stateVal = "disconnected";
      const setStateMock = vi.fn().mockImplementation((val: string) => {
        stateVal = val;
      });

      // Mock react hooks
      (useState as Mock)
        .mockReturnValueOnce([stateVal, setStateMock]) // status
        .mockReturnValueOnce([0, vi.fn()]) // eventCount
        .mockReturnValueOnce([0, vi.fn()]); // activeConnections

      const subscriptionsMap = new Map();
      (useRef as Mock).mockReturnValue({ current: subscriptionsMap });
      (useEffect as Mock).mockImplementation((effect) => effect());

      // Render provider as a function
      const element = SseProvider({
        endpoint: "/api/sse",
        children: "test-node",
      });

      expect(element).toBeDefined();

      const multiplexer = getLatestMultiplexer();
      expect(multiplexer).toBeDefined();
    });
  });
});
