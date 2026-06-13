"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountRow({
  id,
  email,
  lastSyncAt,
}: {
  id: string;
  email: string;
  lastSyncAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "remove" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setBusy("sync");
    setMessage(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setMessage(`Synced ${data.processed ?? 0} emails, ${data.updated ?? 0} subscriptions updated.`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${email}? Its subscriptions will be kept but unlinked.`)) return;
    setBusy("remove");
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove account");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to remove account");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{email}</p>
          <p className="text-xs text-gray-500">
            {lastSyncAt ? `Last synced ${new Date(lastSyncAt).toLocaleString()}` : "Never synced"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={busy !== null}
            className="rounded border border-black/10 px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
          >
            {busy === "sync" ? "Syncing…" : "Sync now"}
          </button>
          <button
            onClick={handleRemove}
            disabled={busy !== null}
            className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
          >
            {busy === "remove" ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </li>
  );
}
