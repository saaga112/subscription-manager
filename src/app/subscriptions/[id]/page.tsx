import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { EditSubscriptionForm } from "./EditSubscriptionForm";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subscription = await db.subscription.findUnique({
    where: { id },
    include: { sourceAccount: { select: { email: true } } },
  });

  if (!subscription) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{subscription.name}</h1>
      {subscription.sourceAccount && (
        <p className="text-sm text-gray-500">Detected via {subscription.sourceAccount.email}</p>
      )}
      <EditSubscriptionForm
        subscription={{
          id: subscription.id,
          name: subscription.name,
          amount: subscription.amount,
          currency: subscription.currency,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          nextRenewalDate: subscription.nextRenewalDate?.toISOString().slice(0, 10) ?? "",
          category: subscription.category ?? "",
          notes: subscription.notes ?? "",
        }}
      />
    </div>
  );
}
