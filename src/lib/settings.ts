import { db } from "@/lib/db";
import type { AppSettings } from "@/generated/prisma/client";
import type { ReminderChannel } from "@/generated/prisma/enums";

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.appSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return db.appSettings.create({ data: { id: 1 } });
}

export function parseReminderDays(value: string): number[] {
  return value
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

export function parseReminderChannels(value: string): ReminderChannel[] {
  return value
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s === "PUSH" || s === "EMAIL") as ReminderChannel[];
}
