import { db } from "@/lib/db";
import { getMessage, listSubscriptionMessageIds } from "@/lib/gmail";
import { parseEmail } from "@/lib/parsers";
import { getSettings } from "@/lib/settings";
import type { ConnectedAccount } from "@/generated/prisma/client";

export interface SyncResult {
  processed: number;
  updated: number;
}

/**
 * Syncs a single connected Gmail account: fetches new subscription-looking
 * emails since the last sync, parses them, and upserts Subscription rows.
 */
export async function syncAccount(account: ConnectedAccount): Promise<SyncResult> {
  const settings = await getSettings();
  const messageIds = await listSubscriptionMessageIds(account, account.lastSyncAt);

  let processed = 0;
  let updated = 0;

  for (const messageId of messageIds) {
    const existing = await db.parsedEmail.findUnique({ where: { gmailMessageId: messageId } });
    if (existing) continue;

    const message = await getMessage(account, messageId);
    if (!message) continue;
    processed++;

    const { data, method } = await parseEmail(message, settings.parsingMode);

    let subscriptionId: string | null = null;
    if (data && data.confidence > 0 && data.amount !== null) {
      const subscription = await upsertSubscription(account, data);
      subscriptionId = subscription.id;
      updated++;
    }

    await db.parsedEmail.create({
      data: {
        accountId: account.id,
        gmailMessageId: messageId,
        subject: message.subject,
        fromAddress: message.from,
        receivedAt: message.receivedAt,
        parseMethod: method,
        confidence: data?.confidence ?? 0,
        rawSnippet: message.snippet,
        subscriptionId,
      },
    });
  }

  await db.connectedAccount.update({
    where: { id: account.id },
    data: { lastSyncAt: new Date() },
  });

  return { processed, updated };
}

async function upsertSubscription(
  account: ConnectedAccount,
  data: NonNullable<Awaited<ReturnType<typeof parseEmail>>["data"]>
) {
  const existing = await db.subscription.findFirst({
    where: {
      sourceAccountId: account.id,
      name: { equals: data.serviceName },
    },
  });

  const nextRenewalDate = data.nextRenewalDate ? new Date(data.nextRenewalDate) : undefined;

  if (existing) {
    return db.subscription.update({
      where: { id: existing.id },
      data: {
        amount: data.amount ?? existing.amount,
        currency: data.currency || existing.currency,
        billingCycle: data.billingCycle !== "UNKNOWN" ? data.billingCycle : existing.billingCycle,
        nextRenewalDate: nextRenewalDate ?? existing.nextRenewalDate,
        lastDetectedAt: new Date(),
      },
    });
  }

  return db.subscription.create({
    data: {
      name: data.serviceName,
      amount: data.amount ?? 0,
      currency: data.currency || "USD",
      billingCycle: data.billingCycle,
      nextRenewalDate,
      lastDetectedAt: new Date(),
      sourceAccountId: account.id,
    },
  });
}

/**
 * Syncs every connected account. Used by the manual "sync all" action and
 * the periodic scheduler.
 */
export async function syncAllAccounts(): Promise<SyncResult> {
  const accounts = await db.connectedAccount.findMany();
  let processed = 0;
  let updated = 0;

  for (const account of accounts) {
    try {
      const result = await syncAccount(account);
      processed += result.processed;
      updated += result.updated;
    } catch (err) {
      console.error(`Sync failed for ${account.email}:`, err);
    }
  }

  return { processed, updated };
}
