import cron from "node-cron";
import { syncAllAccounts } from "@/lib/sync";
import { checkReminders } from "@/lib/reminders";

let started = false;

/**
 * Starts the periodic background jobs: Gmail sync every few hours, and a
 * daily reminder check. Safe to call multiple times — only registers once.
 */
export function startScheduler() {
  if (started) return;
  started = true;

  const syncSchedule = process.env.SYNC_CRON_SCHEDULE || "0 */6 * * *";
  const reminderSchedule = process.env.REMINDER_CRON_SCHEDULE || "0 9 * * *";

  cron.schedule(syncSchedule, async () => {
    try {
      const result = await syncAllAccounts();
      console.log(`[scheduler] sync complete: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error("[scheduler] sync failed:", err);
    }
  });

  cron.schedule(reminderSchedule, async () => {
    try {
      const result = await checkReminders();
      console.log(`[scheduler] reminder check complete: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error("[scheduler] reminder check failed:", err);
    }
  });

  console.log(
    `[scheduler] started (sync: "${syncSchedule}", reminders: "${reminderSchedule}")`
  );
}
