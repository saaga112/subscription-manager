"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface SettingsData {
  parsingMode: string;
  reminderDaysBefore: string;
  reminderChannels: string;
  reminderFromAccountId: string;
  notificationEmail: string;
}

export function SettingsForm({
  settings,
  accounts,
  llmAvailable,
}: {
  settings: SettingsData;
  accounts: { id: string; email: string }[];
  llmAvailable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channelSet = new Set(settings.reminderChannels.split(",").map((c) => c.trim()));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const form = new FormData(e.currentTarget);

    const channels = form.getAll("reminderChannels");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsingMode: form.get("parsingMode"),
          reminderDaysBefore: form.get("reminderDaysBefore"),
          reminderChannels: channels.join(","),
          reminderFromAccountId: form.get("reminderFromAccountId") || null,
          notificationEmail: form.get("notificationEmail"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save settings");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-lg font-medium">Email parsing</legend>
        <label className="flex flex-col gap-1 text-sm">
          Parsing mode
          <select
            name="parsingMode"
            defaultValue={settings.parsingMode}
            className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent"
          >
            <option value="RULE">Rule-based only</option>
            <option value="HYBRID">Hybrid (rules first, LLM fallback)</option>
            <option value="LLM">LLM first (falls back to rules)</option>
          </select>
        </label>
        {!llmAvailable && (
          <p className="text-xs text-gray-500">
            No <code>OPENROUTER_API_KEY</code> is configured, so Hybrid/LLM modes will
            automatically fall back to rule-based parsing.
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-lg font-medium">Reminders</legend>
        <label className="flex flex-col gap-1 text-sm">
          Remind me this many days before renewal (comma-separated)
          <input
            name="reminderDaysBefore"
            defaultValue={settings.reminderDaysBefore}
            placeholder="3,1"
            className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent"
          />
        </label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="reminderChannels" value="PUSH" defaultChecked={channelSet.has("PUSH")} />
            Push notification
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="reminderChannels" value="EMAIL" defaultChecked={channelSet.has("EMAIL")} />
            Email
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Send reminder emails from
          <select
            name="reminderFromAccountId"
            defaultValue={settings.reminderFromAccountId}
            className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent"
          >
            <option value="">First connected account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Send reminder emails to (defaults to the sending account)
          <input
            name="notificationEmail"
            type="email"
            defaultValue={settings.notificationEmail}
            placeholder="you@example.com"
            className="rounded border border-black/20 px-2 py-1 dark:border-white/20 dark:bg-transparent"
          />
        </label>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Settings saved.</p>}

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
