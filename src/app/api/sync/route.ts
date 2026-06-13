import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncAccount, syncAllAccounts } from "@/lib/sync";

export async function POST(request: NextRequest) {
  let accountId: string | undefined;
  try {
    const body = await request.json();
    accountId = body?.accountId;
  } catch {
    // no body provided -> sync all accounts
  }

  try {
    if (accountId) {
      const account = await db.connectedAccount.findUnique({ where: { id: accountId } });
      if (!account) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }
      const result = await syncAccount(account);
      return NextResponse.json(result);
    }

    const result = await syncAllAccounts();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
