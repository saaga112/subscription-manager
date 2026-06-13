import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isLLMAvailable } from "@/lib/parsers";
import { isPushConfigured } from "@/lib/push";
import { SettingsForm } from "./SettingsForm";
import { PushOptIn } from "./PushOptIn";

export default async function SettingsPage() {
  const settings = await getSettings();
  const accounts = await db.connectedAccount.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <SettingsForm
        settings={{
          parsingMode: settings.parsingMode,
          reminderDaysBefore: settings.reminderDaysBefore,
          reminderChannels: settings.reminderChannels,
          reminderFromAccountId: settings.reminderFromAccountId ?? "",
          notificationEmail: settings.notificationEmail ?? "",
        }}
        accounts={accounts.map((a) => ({ id: a.id, email: a.email }))}
        llmAvailable={isLLMAvailable()}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Push notifications</h2>
        {isPushConfigured() ? (
          <PushOptIn />
        ) : (
          <p className="text-sm text-gray-500">
            Push notifications are not configured. Set <code>VAPID_PUBLIC_KEY</code> and{" "}
            <code>VAPID_PRIVATE_KEY</code> in your environment (run{" "}
            <code>npx web-push generate-vapid-keys</code>) to enable them.
          </p>
        )}
      </section>
    </div>
  );
}
