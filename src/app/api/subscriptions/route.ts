import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BillingCycle, SubscriptionStatus } from "@/generated/prisma/enums";

export async function GET() {
  const subscriptions = await db.subscription.findMany({
    include: { sourceAccount: { select: { email: true } } },
    orderBy: [{ status: "asc" }, { nextRenewalDate: "asc" }],
  });
  return NextResponse.json(subscriptions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
  }

  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "USD";

  const billingCycle = Object.values(BillingCycle).includes(body.billingCycle)
    ? body.billingCycle
    : "UNKNOWN";

  const status = Object.values(SubscriptionStatus).includes(body.status)
    ? body.status
    : "ACTIVE";

  let nextRenewalDate: Date | null = null;
  if (body.nextRenewalDate) {
    const d = new Date(body.nextRenewalDate);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "nextRenewalDate is invalid" }, { status: 400 });
    }
    nextRenewalDate = d;
  }

  const subscription = await db.subscription.create({
    data: {
      name,
      amount,
      currency,
      billingCycle,
      status,
      nextRenewalDate,
      category: typeof body.category === "string" ? body.category.trim() || null : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    },
  });

  return NextResponse.json(subscription, { status: 201 });
}
