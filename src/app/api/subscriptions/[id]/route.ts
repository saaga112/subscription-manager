import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BillingCycle, SubscriptionStatus } from "@/generated/prisma/enums";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const subscription = await db.subscription.findUnique({ where: { id } });
  if (!subscription) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(subscription);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await db.subscription.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
    data.name = name;
  }

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
    }
    data.amount = amount;
  }

  if (body.currency !== undefined) {
    data.currency = String(body.currency).trim().toUpperCase() || "USD";
  }

  if (body.billingCycle !== undefined) {
    if (!Object.values(BillingCycle).includes(body.billingCycle)) {
      return NextResponse.json({ error: "invalid billingCycle" }, { status: 400 });
    }
    data.billingCycle = body.billingCycle;
  }

  if (body.status !== undefined) {
    if (!Object.values(SubscriptionStatus).includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = body.status;
  }

  if (body.nextRenewalDate !== undefined) {
    if (body.nextRenewalDate === null) {
      data.nextRenewalDate = null;
    } else {
      const d = new Date(body.nextRenewalDate);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "nextRenewalDate is invalid" }, { status: 400 });
      }
      data.nextRenewalDate = d;
    }
  }

  if (body.category !== undefined) {
    data.category = body.category ? String(body.category).trim() : null;
  }

  if (body.notes !== undefined) {
    data.notes = body.notes ? String(body.notes).trim() : null;
  }

  const subscription = await db.subscription.update({ where: { id }, data });
  return NextResponse.json(subscription);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.subscription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
