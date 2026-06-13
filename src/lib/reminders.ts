import { db } from "@/lib/db";
import { sendPushToAll } from "@/lib/push";
import { sendReminderEmail } from "@/lib/mailer";
import { getSettings, parseReminderDays, parseReminderChannels } from "@/lib/settings";
import { formatCurrency, formatCycle } from "@/lib/billing";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

export interface ReminderCheckResult {
  checked: number;
  sent: number;
}

/**
 * Checks every active subscription's next renewal date against the
 * configured reminder windows and sends push/email reminders for any that
 * are due, recording a ReminderLog to avoid duplicate sends.
 */
export async function checkReminders(): Promise<ReminderCheckResult> {
  const settings = await getSettings();
  const days = parseReminderDays(settings.reminderDaysBefore);
  const channels = parseReminderChannels(settings.reminderChannels);

  if (days.length === 0 || channels.length === 0) {
    return { checked: 0, sent: 0 };
  }

  const now = new Date();
  const maxDays = Math.max(...days);
  const horizon = new Date(now.getTime() + (maxDays + 1) * 24 * 60 * 60 * 1000);

  const subscriptions = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      nextRenewalDate: { gte: startOfDay(now), lte: horizon },
    },
  });

  let sent = 0;

  for (const sub of subscriptions) {
    if (!sub.nextRenewalDate) continue;
    const daysUntil = daysBetween(now, sub.nextRenewalDate);
    if (!days.includes(daysUntil)) continue;

    for (const channel of channels) {
      const alreadySent = await db.reminderLog.findFirst({
        where: {
          subscriptionId: sub.id,
          channel,
          renewalDateSnapshot: sub.nextRenewalDate,
        },
      });
      if (alreadySent) continue;

      const title = `${sub.name} renews in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
      const body = `${formatCurrency(sub.amount, sub.currency)} / ${formatCycle(sub.billingCycle).toLowerCase()} — renews on ${sub.nextRenewalDate.toLocaleDateString()}`;

      let delivered = false;
      if (channel === "PUSH") {
        delivered = (await sendPushToAll({ title, body, url: `/subscriptions/${sub.id}` })) > 0;
      } else if (channel === "EMAIL") {
        delivered = await sendReminderEmail(title, body);
      }

      if (delivered) {
        await db.reminderLog.create({
          data: {
            subscriptionId: sub.id,
            channel,
            renewalDateSnapshot: sub.nextRenewalDate,
          },
        });
        sent++;
      }
    }
  }

  return { checked: subscriptions.length, sent };
}
