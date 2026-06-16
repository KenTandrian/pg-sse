"use client";

export function MetricCard({ count }: { count: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 flex flex-col justify-between shadow-xs">
      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
        Total Events Captured
      </span>
      <span className="text-4xl font-extrabold tracking-tight text-neutral-100 mt-4">
        {count}
      </span>
    </div>
  );
}
