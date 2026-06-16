"use client";

import { useState } from "react";

export function FilterCard({
  subscriptionTable,
  setSubscriptionTable,
  isSubscribed,
  setIsSubscribed,
}: {
  subscriptionTable: string;
  setSubscriptionTable: (val: string) => void;
  isSubscribed: boolean;
  setIsSubscribed: (val: boolean) => void;
}) {
  const [isDirty, setIsDirty] = useState(false);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 flex flex-col justify-between shadow-xs">
      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
        Target Database Table
      </span>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const val = new FormData(e.currentTarget).get("table") as string;
          if (val) {
            setSubscriptionTable(val.replace(/[^a-zA-Z0-9_]/g, ""));
            setIsDirty(false);
          }
        }}
        className="flex items-center gap-2 mt-4"
      >
        <input
          name="table"
          defaultValue={subscriptionTable}
          onChange={(e) =>
            setIsDirty(e.target.value.trim() !== subscriptionTable)
          }
          disabled={!isSubscribed}
          placeholder="e.g. users"
          className="bg-neutral-950 border border-neutral-800 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 w-36 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isSubscribed || !isDirty}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-800 text-neutral-200 hover:bg-neutral-700 disabled:opacity-40 transition cursor-pointer"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => setIsSubscribed(!isSubscribed)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer shadow-xs active:scale-95 ${
            isSubscribed
              ? "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              : "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 font-semibold"
          }`}
        >
          {isSubscribed ? "Pause" : "Resume"}
        </button>
      </form>
    </div>
  );
}
