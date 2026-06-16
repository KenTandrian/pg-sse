import { PostgresSseListener } from "pg-sse/server";

const globalForPgSse = globalThis as unknown as {
  pgListener?: PostgresSseListener;
};

// Fallback securely to a valid connection string if env is not provided during development build
const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/postgres";

export const pgListener =
  globalForPgSse.pgListener ??
  new PostgresSseListener(connectionString, "pg_sse_events");

if (process.env.NODE_ENV !== "production") {
  globalForPgSse.pgListener = pgListener;
}

// Initiate non-blocking connection
pgListener.connect().catch((err) => {
  console.warn("[pg-sse] Development listener connect info:", err.message);
});
