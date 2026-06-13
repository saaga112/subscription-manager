import { NextRequest, NextResponse } from "next/server";
import { connectAccountFromCode } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const base = request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${base}/accounts?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/accounts?error=missing_code`);
  }

  try {
    await connectAccountFromCode(code);
    return NextResponse.redirect(`${base}/accounts?connected=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect account";
    return NextResponse.redirect(`${base}/accounts?error=${encodeURIComponent(message)}`);
  }
}
