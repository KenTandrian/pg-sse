# Product Requirement Document (PRD): `@kentandrian/pg-sse`

Real-Time PostgreSQL Subscriptions for Next.js & React. Zero external dependencies. Zero vendor lock-in.

## 1. Executive Summary

### Overview

`@kentandrian/pg-sse` is a lightweight, zero-dependency TypeScript library that bridges PostgreSQL real-time database updates (`LISTEN`/`NOTIFY`) to React client interfaces using Server-Sent Events (SSE).

### The Problem

React and Next.js developers want to add real-time features (chat, notifications, live stats) to standard PostgreSQL databases. Currently, they face two options:

1. **Vendor Lock-in (BaaS):** Migrate their database or backend stack to Supabase or Convex to use their real-time client SDKs.
2. **Third-Party Services (SaaS):** Sign up for managed WebSocket networks like Pusher or Ably, which requires managing external accounts, credentials, and paying message usage fees.
3. **Complex Custom Code:** Write custom WebSockets or SSE listener code, which often leads to database connection pool exhaustion, browser tab connection duplicate socket leaks, and complex reconnection state machines.

### The Solution

`@kentandrian/pg-sse` provides a complete client-server real-time pub/sub solution that runs entirely in-process on standard PostgreSQL and Next.js/React. It multiplexes client streams and server-side listeners to keep database connections to **exactly 1** per Node.js process, handling connection resilience and browser tab multiplexing natively.

## 2. Product Positioning & Value Prop

- **Zero External Dependencies:** Only requires standard peer dependencies (`pg`, `react`, `react-dom`). No complex dynamic-import libraries (like `pg-format`) that break Turbopack/Next.js compilers.
- **100% In-Process:** Runs inside your existing Next.js App Router and Cloud Run containers. No external accounts or paid message servers required.
- **High Efficiency:** Multiplexes all browser connections into a single backend database listener connection, protecting the Postgres pool.
- **Resilient Out-of-the-Box:** Includes automatic exponential backoff, randomized jitter retry, and keep-alive ping intervals.
- **Type-Safe:** Built in TypeScript with a custom, zero-dependency `TypedEmitter` utility.

## 3. Functional Requirements

### 3.1. Server-Side PG Listener

- **Connection Multiplexing:** Must consume exactly **one** PostgreSQL connection from the application's connection pool to execute `LISTEN` commands, sharing that connection across all incoming HTTP stream clients.
- **Event Parsing:** Automatically parse incoming string payloads from PostgreSQL `NOTIFY` events. If the payload is JSON, parse it as a JavaScript object; otherwise, fall back to string.
- **Connection Resilience:** Detect connection drops to the database (e.g. proxy restarts or DB maintenance) and run automatic reconnection routines under the hood.
- **Type-Safe Events:** Expose a typed event emitter for listener connection states (`connected`, `error`, `reconnect`, `notification`).

### 3.2. Server-Side Next.js Route Handler Helper

- **Header Configuration:** Configure correct headers for Server-Sent Events (`Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`).
- **Keep-Alives:** Periodically stream keep-alive comments/pings (default: 20 seconds) to prevent serverless proxies (like Cloud Run or Cloudflare) from terminating idle connections.
- **Client Registry:** Maintain an in-memory registry of active streams to broadcast events instantly.
- **Handshake Telemetry:** Include handshake payload indicating successful connection and the current number of active connections.

### 3.3. Client-Side React Context

- **Tab Multiplexing:** Restrict browser tabs to exactly **one** active `EventSource` connection to the SSE API route.
- **Subscription Management:** Expose a subscription registration handler that hooks callbacks to specific table channels in-memory.
- **Connection Re-try with Backoff & Jitter:** If the server connection drops (e.g. container recycles), retry connection using exponential backoff (starting at 1s, doubling up to 30s) with randomized jitter (+0 to 1000ms) to prevent server thundering herds.
- **Graceful Logging:** Demote common transient connection disconnect errors to `console.warn` instead of red `console.error` logs.
- **State Exposure:** Expose connection status (`connecting` | `connected` | `disconnected`), total tab session event count, and server active clients count to React components.

## 4. Technical Architecture & API Specification

### 4.1. The Shared Emitter (`src/shared/emitter.ts`)

A zero-dependency TypeScript implementation of a type-safe event emitter wrapping Node's `EventEmitter`:

```typescript
import { EventEmitter } from "events";

export class TypedEmitter<
  Events extends Record<string, any>,
> extends EventEmitter {
  on<K extends keyof Events>(
    event: K,
    listener: (payload: Events[K]) => void,
  ): this {
    return super.on(event as string, listener);
  }
  emit<K extends keyof Events>(event: K, payload: Events[K]): boolean {
    return super.emit(event as string, payload);
  }
}
```

### 4.2. Server Listener API (`src/server/listener.ts`)

```typescript
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
    [key: string]: any;
  };
}

export interface SseListener {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  events: TypedEmitter<SseListenerEvents>;
  getActiveConnections(): number;
}
```

### 4.3. Client Context & Hook API (`src/client/provider.tsx`)

```typescript
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface SseContextType {
  subscribe: (table: string, callback: (payload: any) => void) => () => void;
  status: ConnectionStatus;
  eventCount: number;
  activeConnections: number;
}

export const SseProvider: React.FC<{
  children: React.ReactNode;
  endpoint: string;
}>;

export function useSubscription(
  table: string,
  callback: (payload: any) => void,
): void;
```

## 5. Non-Functional Requirements

### 5.1. Performance & Scale

- **PostgreSQL Connection Overhead:** exactly 1 client connection.
- **Memory Footprint:** In-memory registry size of active clients must scale linearly with the number of concurrent users (approx. 200 bytes per active browser tab).
- **Payload Limit:** Must support PostgreSQL standard payload size of 8000 bytes. Larger payload structures must use the "thin event" pattern (sending IDs, querying values on the side).

### 5.2. Build & Compatibility

- **React Support:** Full support for React 19 (including Next.js 15+ Server Actions and Route Handlers).
- **Compiler Compatibility:** Must compile with Next.js Turbopack (no dynamic `__dirname` requires or native dependencies).
- **Target Exports:** Dual build targeting ESM and CommonJS exports.
