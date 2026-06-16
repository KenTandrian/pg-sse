"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ConnectionStatus, TabMultiplexer } from "./multiplexer";

export interface SseContextType {
  subscribe: <T = unknown>(
    table: string,
    callback: (payload: T) => void,
  ) => () => void;
  status: ConnectionStatus;
  eventCount: number;
  activeConnections: number;
}

const SseContext = createContext<SseContextType | null>(null);

export const SseProvider: React.FC<{
  children: React.ReactNode;
  endpoint: string;
}> = ({ children, endpoint }) => {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [eventCount, setEventCount] = useState(0);
  const [activeConnections, setActiveConnections] = useState(0);

  // Keep subscriptions in a ref to avoid triggering re-renders on subscription updates
  const subscriptions = useRef<Map<string, Set<(payload: unknown) => void>>>(
    new Map(),
  );

  // Handle status and active connection count updates
  const handleStatusChange = useCallback(
    (newStatus: ConnectionStatus, activeCount: number) => {
      setActiveConnections(activeCount);
      setStatus((prev) => {
        if (newStatus === "connecting") {
          if (prev === "connected") {
            console.warn(`[pg-sse] Stream connection lost. Reconnecting...`);
          } else if (prev === "disconnected") {
            console.log(`[pg-sse] Connecting to stream...`);
          }
        } else if (newStatus === "connected" && prev !== "connected") {
          console.log(
            `[pg-sse] Stream connected. Active client count: ${activeCount}`,
          );
        }
        return newStatus;
      });
    },
    [],
  );

  // Dispatch events to matching subscribers
  const handleEvent = useCallback((event: string, payload: unknown) => {
    if (event === "notification") {
      setEventCount((prev) => prev + 1);

      const table = (payload as Record<string, unknown> | null)?.table as
        | string
        | undefined;
      if (table) {
        const callbacks = subscriptions.current.get(table);
        if (callbacks) {
          callbacks.forEach((cb) => {
            try {
              cb(payload);
            } catch (err) {
              console.error(
                `[pg-sse] Callback for table "${table}" failed:`,
                err,
              );
            }
          });
        }
      }
    }
  }, []);

  useEffect(() => {
    const multiplexer = new TabMultiplexer(
      endpoint,
      handleEvent,
      handleStatusChange,
    );

    return () => {
      multiplexer.destroy();
    };
  }, [endpoint, handleEvent, handleStatusChange]);

  const subscribe = useCallback(
    <T = unknown,>(table: string, callback: (payload: T) => void) => {
      let callbacks = subscriptions.current.get(table);
      if (!callbacks) {
        callbacks = new Set();
        subscriptions.current.set(table, callbacks);
      }
      callbacks.add(callback as (payload: unknown) => void);

      return () => {
        const callbacks = subscriptions.current.get(table);
        if (callbacks) {
          callbacks.delete(callback as (payload: unknown) => void);
          if (callbacks.size === 0) {
            subscriptions.current.delete(table);
          }
        }
      };
    },
    [],
  );

  return (
    <SseContext.Provider
      value={{ subscribe, status, eventCount, activeConnections }}
    >
      {children}
    </SseContext.Provider>
  );
};

export function useSubscription<T = unknown>(
  table: string,
  callback: (payload: T) => void,
): void {
  const context = useContext(SseContext);
  if (!context) {
    throw new Error("useSubscription must be used within an SseProvider");
  }

  const { subscribe } = context;
  const callbackRef = useRef(callback);

  // Keep callback ref updated so subscription doesn't re-subscribe on every callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsubscribe = subscribe<T>(table, (payload) => {
      callbackRef.current(payload);
    });
    return unsubscribe;
  }, [table, subscribe]);
}

export function useSseStatus(): {
  status: ConnectionStatus;
  eventCount: number;
  activeConnections: number;
} {
  const context = useContext(SseContext);
  if (!context) {
    throw new Error("useSseStatus must be used within an SseProvider");
  }
  const { status, eventCount, activeConnections } = context;
  return { status, eventCount, activeConnections };
}
