"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency, formatCycle } from "@/lib/billing";

export interface SubscriptionRow {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextRenewalDate: string | null;
  status: string;
  sourceAccountEmail: string | null;
}

export function SubscriptionTable({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleStatus(sub: SubscriptionRow) {
    setBusyId(sub.id);
    try {
      const newStatus = sub.status === "ACTIVE" ? "CANCELLED" : "ACTIVE";
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(sub: SubscriptionRow) {
    if (!confirm(`Delete ${sub.name}?`)) return;
    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (subscriptions.length === 0) {
    return <p className="text-sm text-gray-500">No subscriptions yet.</p>;
  }

  return (
    <ul className="divide-y divide-black/10 dark:divide-white/10">
      {subscriptions.map((sub) => (
        <li key={sub.id} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <Link href={`/subscriptions/${sub.id}`} className="font-medium hover:underline">
              {sub.name}
            </Link>
            <p className="text-xs text-gray-500">
              {formatCurrency(sub.amount, sub.currency)} / {formatCycle(sub.billingCycle as never).toLowerCase()}
              {sub.nextRenewalDate ? ` · renews ${new Date(sub.nextRenewalDate).toLocaleDateString()}` : ""}
              {sub.sourceAccountEmail ? ` · via ${sub.sourceAccountEmail}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                sub.status === "ACTIVE"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {sub.status}
            </span>
            <button
              onClick={() => toggleStatus(sub)}
              disabled={busyId === sub.id}
              className="rounded border border-black/10 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
            >
              {sub.status === "ACTIVE" ? "Cancel" : "Reactivate"}
            </button>
            <button
              onClick={() => remove(sub)}
              disabled={busyId === sub.id}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
