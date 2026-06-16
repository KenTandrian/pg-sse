"use client";

interface DatabaseNotification {
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  id: string | number;
  [key: string]: unknown;
}

export function FeedList({ events }: { events: DatabaseNotification[] }) {
  return (
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
            Execute an INSERT, UPDATE, or DELETE query in PostgreSQL to capture
            streaming payloads.
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
                <span className="text-neutral-100 font-semibold">{evt.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
