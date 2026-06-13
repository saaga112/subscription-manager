import { NextRequest, NextResponse } from "next/server";
import { syncAllAccounts } from "@/lib/sync";
import { checkReminders } from "@/lib/reminders";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const sync = await syncAllAccounts();
  const reminders = await checkReminders();

  return NextResponse.json({ sync, reminders });
}
