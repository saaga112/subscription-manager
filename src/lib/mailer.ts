import { db } from "@/lib/db";
import { sendEmail } from "@/lib/gmail";
import { getSettings } from "@/lib/settings";

/**
 * Sends a reminder email using one of the connected Gmail accounts as the
 * sender. Returns false if no connected account is available.
 */
export async function sendReminderEmail(subject: string, body: string): Promise<boolean> {
  const settings = await getSettings();

  const fromAccount = settings.reminderFromAccountId
    ? await db.connectedAccount.findUnique({ where: { id: settings.reminderFromAccountId } })
    : await db.connectedAccount.findFirst({ orderBy: { createdAt: "asc" } });

  if (!fromAccount) return false;

  const to = settings.notificationEmail || fromAccount.email;

  await sendEmail(fromAccount, to, subject, body);
  return true;
}
