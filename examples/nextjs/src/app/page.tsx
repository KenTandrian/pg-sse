"use client";

import { FeedList } from "@/components/feed-list";
import { FilterCard } from "@/components/filter-card";
import { Header } from "@/components/header";
import { MetricCard } from "@/components/metric-card";
import { useSubscription } from "pg-sse/client";
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

  // Subscribe using our custom hook
  useSubscription<DatabaseNotification>(
    isSubscribed ? subscriptionTable : "",
    (payload) => {
      setEvents((prev) => [payload, ...prev].slice(0, 50)); // Keep recent 50 events
    }
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-6 md:p-10 max-w-6xl mx-auto flex flex-col gap-8">
      <Header />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard count={events.length} />
        <FilterCard
          subscriptionTable={subscriptionTable}
          setSubscriptionTable={setSubscriptionTable}
          isSubscribed={isSubscribed}
          setIsSubscribed={setIsSubscribed}
        />
      </div>

      <FeedList events={events} />
    </div>
  );
}
