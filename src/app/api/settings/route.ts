import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ParsingMode } from "@/generated/prisma/enums";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const data: Record<string, unknown> = {};

  if (body.parsingMode !== undefined) {
    if (!Object.values(ParsingMode).includes(body.parsingMode)) {
      return NextResponse.json({ error: "invalid parsingMode" }, { status: 400 });
    }
    data.parsingMode = body.parsingMode;
  }

  if (body.reminderDaysBefore !== undefined) {
    const value = String(body.reminderDaysBefore);
    if (!/^\d+(,\d+)*$/.test(value)) {
      return NextResponse.json(
        { error: "reminderDaysBefore must be a comma-separated list of numbers" },
        { status: 400 }
      );
    }
    data.reminderDaysBefore = value;
  }

  if (body.reminderChannels !== undefined) {
    const channels = String(body.reminderChannels)
      .split(",")
      .map((c) => c.trim().toUpperCase());
    if (!channels.every((c) => c === "PUSH" || c === "EMAIL")) {
      return NextResponse.json({ error: "reminderChannels must be PUSH and/or EMAIL" }, { status: 400 });
    }
    data.reminderChannels = channels.join(",");
  }

  if (body.reminderFromAccountId !== undefined) {
    data.reminderFromAccountId = body.reminderFromAccountId || null;
  }

  if (body.notificationEmail !== undefined) {
    data.notificationEmail = body.notificationEmail ? String(body.notificationEmail).trim() : null;
  }

  await getSettings();
  const settings = await db.appSettings.update({ where: { id: 1 }, data });
  return NextResponse.json(settings);
}
