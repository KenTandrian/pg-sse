"use client";

import { useSseStatus, useSubscription } from "pg-sse/client";
import { useState } from "react";

interface DatabaseNotification {
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  id: string | number;
  [key: string]: unknown;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<DatabaseNotification[]>([]);
  const [subscriptionTable, setSubscriptionTable] = useState("users");
  const [isSubscribed, setIsSubscribed] = useState(true);

  let sseStatus = "connected";
  let activeConnections = 1;
  try {
    const statusObj = useSseStatus();
    sseStatus = statusObj.status;
    activeConnections = statusObj.activeConnections;
  } catch (err) {
    // Fallback if rendered outside provider during static build
  }

  // Subscribe using our custom hook
  useSubscription<DatabaseNotification>(
    isSubscribed ? subscriptionTable : "",
    (payload) => {
      setEvents((prev) => [payload, ...prev].slice(0, 50)); // Keep recent 50 events
    }
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-6 md:p-10 max-w-6xl mx-auto flex flex-col gap-8">
      {/* Header (shadcn style) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-neutral-800">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-100">
            Real-Time Monitor
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            In-process PostgreSQL real-time subscriptions via Server-Sent
            Events.
          </p>
        </div>

        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-medium">
          <span
            className={`w-2 h-2 rounded-full ${
              sseStatus === "connected"
                ? "bg-emerald-500 animate-pulse"
                : sseStatus === "connecting"
                  ? "bg-amber-500 animate-ping"
                  : "bg-rose-500"
            }`}
          />
          <span className="text-neutral-300">
            {sseStatus === "connected"
              ? `Connected (${activeConnections} tab${activeConnections > 1 ? "s" : ""})`
              : sseStatus === "connecting"
                ? "Reconnecting..."
                : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Metrics & Controls Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Total Events Metric Card */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Total Events Captured
          </span>
          <span className="text-4xl font-extrabold tracking-tight text-neutral-100 mt-4">
            {events.length}
          </span>
        </div>

        {/* Subscription Target Card */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Target Database Table
          </span>

          <div className="flex items-center gap-3 mt-4">
            <input
              type="text"
              value={subscriptionTable}
              onChange={(e) =>
                setSubscriptionTable(
                  e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                )
              }
              disabled={!isSubscribed}
              placeholder="e.g. users"
              className="bg-neutral-950 border border-neutral-800 rounded-md px-3.5 py-2 text-sm font-medium text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 w-44 transition disabled:opacity-50"
            />
            <button
              onClick={() => setIsSubscribed(!isSubscribed)}
              className={`px-4 py-2 rounded-md text-xs font-medium transition cursor-pointer shadow-xs active:scale-95 ${
                isSubscribed
                  ? "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                  : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 font-semibold"
              }`}
            >
              {isSubscribed ? "Pause" : "Resume"}
            </button>
          </div>
        </div>
      </div>

      {/* Live Feed Card (shadcn Table / List Style) */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 shadow-xs flex flex-col gap-6">
        <div className="pb-4 border-b border-neutral-800">
          <h2 className="text-base font-semibold tracking-tight text-neutral-100">
            Real-Time Feed (LISTEN/NOTIFY)
          </h2>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <span className="text-2xl">⚡️</span>
            <span className="text-sm font-medium text-neutral-300">
              No activity recorded yet
            </span>
            <p className="text-xs text-neutral-500 max-w-xs">
              Execute an INSERT, UPDATE, or DELETE query in PostgreSQL to
              capture streaming payloads.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[450px] overflow-y-auto pr-1">
            {events.map((evt, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 hover:border-neutral-700 transition"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                      evt.action === "INSERT"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : evt.action === "UPDATE"
                          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {evt.action}
                  </span>
                  <span className="text-sm font-medium text-neutral-300">
                    {evt.table}
                  </span>
                </div>

                <div className="text-xs font-mono text-neutral-400">
                  ID:{" "}
                  <span className="text-neutral-100 font-semibold">
                    {evt.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
