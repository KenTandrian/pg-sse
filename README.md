# pg-sse

Real-Time PostgreSQL Subscriptions for Next.js & React via Server-Sent Events (SSE). Zero external dependencies. Zero vendor lock-in.

## Features

- **Zero SaaS Dependencies:** Runs entirely in-process on your standard PostgreSQL and Next.js / Node.js backend. No Pusher, Ably, or Supabase lock-in required.
- **Database Pool Protection:** Multiplexes all incoming client streams into exactly **one** PostgreSQL connection per Node.js process using `LISTEN`/`NOTIFY`.
- **Browser Tab Multiplexing:** Restricts active event streams to exactly **one** socket connection per browser, sharing events across sibling tabs using `BroadcastChannel` with automated leader election.
- **Resilient Reconnection:** Native retry mechanism featuring exponential backoff and randomized jitter to prevent thundering herd scenarios when backend instances recycle.
- **Type-Safe:** Written in 100% type-safe TypeScript.

## Installation

```bash
pnpm add pg-sse pg
# or
npm install pg-sse pg
# or
yarn add pg-sse pg
```

Make sure you have standard peer dependencies installed (`pg`, `react`, and `react-dom`).

## Step-by-Step Setup Guide

### 1. Database Setup: PostgreSQL Triggers

Add a trigger function to your PostgreSQL database to dispatch notify payloads whenever records change.

```sql
-- Create trigger function that serializes table actions to JSON
CREATE OR REPLACE FUNCTION notify_table_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'pg_sse_events',
    json_build_object(
      'table', TG_TABLE_NAME,
      'action', TG_OP,
      'id', COALESCE(NEW.id, OLD.id)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to your tables (e.g. users)
CREATE TRIGGER users_update_trigger
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION notify_table_update();
```

### 2. Server Setup: PostgreSQL Listener

Initialize the `PostgresSseListener` instance exactly **once** in your Node.js server to start listening to PostgreSQL events.

```typescript
// lib/pg-listener.ts
import { PostgresSseListener } from "pg-sse/server";

// Ensure a single persistent instance in Next.js development hot-reloads
const globalForPgSse = globalThis as unknown as {
  pgListener?: PostgresSseListener;
};

export const pgListener =
  globalForPgSse.pgListener ??
  new PostgresSseListener(
    {
      connectionString: process.env.DATABASE_URL,
    },
    "pg_sse_events",
  );

if (process.env.NODE_ENV !== "production") {
  globalForPgSse.pgListener = pgListener;
}

// Start listening (returns promise, handles auto-reconnections internally)
pgListener.connect();
```

### 3. Server Setup: Next.js API Route Handler

Create a Next.js App Router Route Handler to stream events. Pass the `pgListener` and the incoming `Request` to the helper.

```typescript
// app/api/sse/route.ts
import { createSseHandler } from "pg-sse/server";
import { pgListener } from "@/lib/pg-listener";

export async function GET(req: Request) {
  // Option: Execute authentication or access validation here before streaming

  return createSseHandler(pgListener, req);
}
```

### 4. Client Setup: React Provider

Wrap your application in the `SseProvider` to establish connection state.

```tsx
// app/layout.tsx
import { SseProvider } from "pg-sse/client";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SseProvider endpoint="/api/sse">{children}</SseProvider>
      </body>
    </html>
  );
}
```

### 5. Client Setup: Component Subscriptions

Use the `useSubscription` hook in Client Components to bind event handlers to database updates.

```tsx
// app/components/UserList.tsx
"use client";

import { useState } from "react";
import { useSubscription } from "pg-sse/client";
import { useRouter } from "next/navigation";

interface UserUpdatePayload {
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  id: number;
}

export function UserList() {
  const router = useRouter();

  // Listen to PostgreSQL updates on the "users" table
  useSubscription<UserUpdatePayload>("users", (payload) => {
    console.log(
      `Database updated on table ${payload.table} (ID: ${payload.id})`,
    );

    // Automatically trigger Server Component page data revalidation
    router.refresh();
  });

  return (
    <div>
      <h3>Live Users Directory</h3>
      {/* Directory content rendered server-side */}
    </div>
  );
}
```

## 🔒 Security Best Practice: The Thin Event Pattern

PostgreSQL notification payloads have a standard size limit of **8000 bytes**. To guarantee security and scalability, you should use the **Thin Event** pattern:

1. **Do not** serialize sensitive rows or rich columns (like emails, password hashes, or messages) directly into the PostgreSQL notification trigger.
2. **Do** only serialize identifiers and actions:
   ```json
   { "table": "users", "action": "UPDATE", "id": 123 }
   ```
3. When the client receives the update notification, query the actual data details through standard, authenticated server endpoints (such as Next.js Server Actions or API routes) where access control lists (ACLs) are strictly enforced.

## API Reference

### Server Side (`pg-sse/server`)

#### `PostgresSseListener(config, channels)`

Initializes a new DB event listener.

- `config`: A `pg.ClientConfig` object or connection string.
- `channels` (optional): Channel string or array of channel strings. Defaults to `"pg_sse_events"`.

#### `createSseHandler(listener, request)`

Generates an SSE stream Response compatible with standard edge and Node.js runtimes.

- `listener`: The active `PostgresSseListener` instance.
- `request` (optional): Incoming Fetch `Request` object. When provided, registers abort listeners to unregister client registry entries instantly on connection loss.

### Client Side (`pg-sse/client`)

#### `<SseProvider endpoint="...">`

Creates the context state and initiates leader election for tab multiplexing.

- `endpoint`: The string API route endpoint URL.

#### `useSubscription<T>(table, callback)`

Registers a component callback for real-time table notifications.

- `table`: The string table name to subscribe to.
- `callback`: `(payload: T) => void` triggered when a matching database notification fires.

## License

MIT
