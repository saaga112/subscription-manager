import Link from "next/link";
import { db } from "@/lib/db";
import { toMonthlyAmount, formatCurrency, formatCycle } from "@/lib/billing";
import { SyncAllButton } from "@/components/SyncAllButton";

export default async function DashboardPage() {
  const subscriptions = await db.subscription.findMany({
    where: { status: "ACTIVE" },
    orderBy: { nextRenewalDate: "asc" },
  });

  const totalsByCurrency = new Map<string, { monthly: number; yearly: number }>();
  for (const sub of subscriptions) {
    const monthly = toMonthlyAmount(sub.amount, sub.billingCycle);
    const entry = totalsByCurrency.get(sub.currency) ?? { monthly: 0, yearly: 0 };
    entry.monthly += monthly;
    entry.yearly += monthly * 12;
    totalsByCurrency.set(sub.currency, entry);
  }

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcoming = subscriptions.filter(
    (s) => s.nextRenewalDate && s.nextRenewalDate >= now && s.nextRenewalDate <= in30Days
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <SyncAllButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {totalsByCurrency.size === 0 ? (
          <p className="text-sm text-gray-500">No active subscriptions yet.</p>
        ) : (
          Array.from(totalsByCurrency.entries()).map(([currency, totals]) => (
            <div key={currency} className="rounded border border-black/10 p-4 dark:border-white/10">
              <p className="text-sm text-gray-500">Estimated spend ({currency})</p>
              <p className="text-2xl font-semibold">{formatCurrency(totals.monthly, currency)} / mo</p>
              <p className="text-sm text-gray-500">{formatCurrency(totals.yearly, currency)} / yr</p>
            </div>
          ))
        )}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Renewing in the next 30 days</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing renewing soon.</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {upcoming.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">{sub.name}</p>
                  <p className="text-xs text-gray-500">{formatCycle(sub.billingCycle)}</p>
                </div>
                <div className="text-right">
                  <p>{formatCurrency(sub.amount, sub.currency)}</p>
                  <p className="text-xs text-gray-500">
                    {sub.nextRenewalDate?.toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium">All active subscriptions</h2>
          <Link href="/subscriptions" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-500">
            No subscriptions yet. Connect a Gmail account and run a sync from{" "}
            <Link href="/accounts" className="text-blue-600 hover:underline">
              Accounts
            </Link>
            , or add one manually on the{" "}
            <Link href="/subscriptions" className="text-blue-600 hover:underline">
              Subscriptions
            </Link>{" "}
            page.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {subscriptions.map((sub) => (
              <li key={sub.id} className="flex items-center justify-between py-2">
                <Link href={`/subscriptions/${sub.id}`} className="font-medium hover:underline">
                  {sub.name}
                </Link>
                <div className="text-right">
                  <p>
                    {formatCurrency(sub.amount, sub.currency)} / {formatCycle(sub.billingCycle).toLowerCase()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {sub.nextRenewalDate ? sub.nextRenewalDate.toLocaleDateString() : "No date detected"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
