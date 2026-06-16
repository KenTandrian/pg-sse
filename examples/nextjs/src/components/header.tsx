"use client";

import { useSseStatus } from "pg-sse/client";

export function Header() {
  let sseStatus = "connected";
  let activeConnections = 1;
  try {
    const statusObj = useSseStatus();
    sseStatus = statusObj.status;
    activeConnections = statusObj.activeConnections;
  } catch (err) {
    // Fallback if rendered outside provider during static build
  }

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-neutral-800">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-100">
          Real-Time Monitor
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          In-process PostgreSQL real-time subscriptions via Server-Sent Events.
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
  );
}
