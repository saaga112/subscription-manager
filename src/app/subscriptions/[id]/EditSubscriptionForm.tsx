"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CYCLES = ["MONTHLY", "YEARLY", "WEEKLY", "QUARTERLY", "UNKNOWN"];
const STATUSES = ["ACTIVE", "TRIAL", "CANCELLED"];

interface SubscriptionFormData {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  status: string;
  nextRenewalDate: string;
  category: string;
  notes: string;
}

export function EditSubscriptionForm({ subscription }: { subscription: SubscriptionFormData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          amount: form.get("amount"),
          currency: form.get("currency"),
          billingCycle: form.get("billingCycle"),
          status: form.get("status"),
          nextRenewalDate: form.get("nextRenewalDate") || null,
          category: form.get("category"),
          notes: form.get("notes"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${subscription.name}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/subscriptions/${subscription.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/subscriptions");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 max-w-xl">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" defaultValue={subscription.name} required className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Amount
        <input name="amount" type="number" step="0.01" min="0" defaultValue={subscription.amount} required className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Currency
        <input name="currency" defaultValue={subscription.currency} maxLength={3} className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Billing cycle
        <select name="billingCycle" defaultValue={subscription.billingCycle} className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent">
          {CYCLES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Status
        <select name="status" defaultValue={subscription.status} className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Next renewal date
        <input name="nextRenewalDate" type="date" defaultValue={subscription.nextRenewalDate} className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Category
        <input name="category" defaultValue={subscription.category} className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>
      <label className="col-span-full flex flex-col gap-1 text-sm">
        Notes
        <textarea name="notes" defaultValue={subscription.notes} rows={3} className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}
      {saved && <p className="col-span-full text-sm text-green-600">Saved.</p>}

      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
        >
          Delete
        </button>
      </div>
    </form>
  );
}
