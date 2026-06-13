import { db } from "@/lib/db";
import { AddSubscriptionForm } from "./AddSubscriptionForm";
import { SubscriptionTable, type SubscriptionRow } from "./SubscriptionTable";

export default async function SubscriptionsPage() {
  const subscriptions = await db.subscription.findMany({
    include: { sourceAccount: { select: { email: true } } },
    orderBy: [{ status: "asc" }, { nextRenewalDate: "asc" }],
  });

  const rows: SubscriptionRow[] = subscriptions.map((sub) => ({
    id: sub.id,
    name: sub.name,
    amount: sub.amount,
    currency: sub.currency,
    billingCycle: sub.billingCycle,
    nextRenewalDate: sub.nextRenewalDate?.toISOString() ?? null,
    status: sub.status,
    sourceAccountEmail: sub.sourceAccount?.email ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Subscriptions</h1>
      <AddSubscriptionForm />
      <SubscriptionTable subscriptions={rows} />
    </div>
  );
}
