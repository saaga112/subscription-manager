"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CYCLES = ["MONTHLY", "YEARLY", "WEEKLY", "QUARTERLY", "UNKNOWN"];

export function AddSubscriptionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          amount: form.get("amount"),
          currency: form.get("currency"),
          billingCycle: form.get("billingCycle"),
          nextRenewalDate: form.get("nextRenewalDate") || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add subscription");
      setOpen(false);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add subscription");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Add subscription
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded border border-black/10 p-4 sm:grid-cols-2 dark:border-white/10"
    >
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" required className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Amount
        <input name="amount" type="number" step="0.01" min="0" required className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Currency
        <input name="currency" defaultValue="USD" maxLength={3} className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Billing cycle
        <select name="billingCycle" defaultValue="MONTHLY" className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent">
          {CYCLES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Next renewal date
        <input name="nextRenewalDate" type="date" className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent" />
      </label>

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}

      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
