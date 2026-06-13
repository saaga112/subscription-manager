import { NextResponse } from "next/server";
import { getConsentUrl } from "@/lib/gmail";

export async function GET() {
  try {
    const url = getConsentUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build consent URL" },
      { status: 500 }
    );
  }
}
