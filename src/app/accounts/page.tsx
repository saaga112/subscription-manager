import Link from "next/link";
import { db } from "@/lib/db";
import { AccountRow } from "./AccountRow";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { error, connected } = await searchParams;
  const accounts = await db.connectedAccount.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Connected Gmail Accounts</h1>
        <Link
          href="/api/accounts/connect"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Connect Gmail Account
        </Link>
      </div>

      {connected && (
        <p className="rounded bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-900 dark:text-green-100">
          Account connected successfully.
        </p>
      )}
      {error && (
        <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900 dark:text-red-100">
          {error}
        </p>
      )}

      {accounts.length === 0 ? (
        <p className="text-sm text-gray-500">
          No Gmail accounts connected yet. Click &quot;Connect Gmail Account&quot; to get
          started.
        </p>
      ) : (
        <ul className="divide-y divide-black/10 dark:divide-white/10">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              id={account.id}
              email={account.email}
              lastSyncAt={account.lastSyncAt?.toISOString() ?? null}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
