import { google, gmail_v1 } from "googleapis";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import type { ConnectedAccount } from "@/generated/prisma/client";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

function getRedirectUri() {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/api/accounts/callback`;
}

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured");
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export function getConsentUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });
}

/**
 * Exchanges an OAuth code for tokens, fetches the account email, and
 * upserts a ConnectedAccount row with encrypted tokens.
 */
export async function connectAccountFromCode(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Remove the app's access in your Google Account and try connecting again."
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: userInfo } = await oauth2.userinfo.get();
  if (!userInfo.email) {
    throw new Error("Unable to determine the account email from Google");
  }

  const expiryDate = new Date(tokens.expiry_date ?? Date.now() + 3600_000);

  return db.connectedAccount.upsert({
    where: { email: userInfo.email },
    create: {
      email: userInfo.email,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiryDate,
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiryDate,
    },
  });
}

/**
 * Returns an authenticated OAuth2 client for the account, refreshing and
 * persisting the access token if it has expired or is close to expiry.
 */
export async function getAuthorizedClient(account: ConnectedAccount) {
  const client = createOAuthClient();
  client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken),
    expiry_date: account.expiryDate.getTime(),
  });

  const needsRefresh = account.expiryDate.getTime() - Date.now() < 60_000;
  if (needsRefresh) {
    const { credentials } = await client.refreshAccessToken();
    if (credentials.access_token) {
      await db.connectedAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encrypt(credentials.access_token),
          expiryDate: new Date(credentials.expiry_date ?? Date.now() + 3600_000),
          ...(credentials.refresh_token
            ? { refreshToken: encrypt(credentials.refresh_token) }
            : {}),
        },
      });
      client.setCredentials(credentials);
    }
  }

  return client;
}

export interface GmailMessageContent {
  id: string;
  subject: string;
  from: string;
  receivedAt: Date;
  snippet: string;
  bodyText: string;
}

const SUBSCRIPTION_SEARCH_QUERY =
  '(subject:(receipt OR invoice OR subscription OR renewal OR "renews on" OR "payment confirmation" OR "your bill" OR "order confirmation" OR billed OR "auto-renew" OR membership) OR from:(billing OR noreply OR no-reply OR receipts))';

/**
 * Lists Gmail message IDs that look like subscription/billing emails,
 * received after `sinceDate` (if provided).
 */
export async function listSubscriptionMessageIds(
  account: ConnectedAccount,
  sinceDate?: Date | null
): Promise<string[]> {
  const auth = await getAuthorizedClient(account);
  const gmail = google.gmail({ version: "v1", auth });

  let query = SUBSCRIPTION_SEARCH_QUERY;
  if (sinceDate) {
    const epochDays = Math.floor(sinceDate.getTime() / 1000);
    query += ` after:${epochDays}`;
  }

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50,
      pageToken,
    });
    for (const m of data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < 200);

  return ids;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.mimeType === "text/html" && payload.body?.data && !payload.parts) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  return "";
}

export async function getMessage(
  account: ConnectedAccount,
  messageId: string
): Promise<GmailMessageContent | null> {
  const auth = await getAuthorizedClient(account);
  const gmail = google.gmail({ version: "v1", auth });

  const { data } = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = data.payload?.headers ?? [];
  const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
  const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
  const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value;
  const receivedAt = data.internalDate
    ? new Date(Number(data.internalDate))
    : dateHeader
      ? new Date(dateHeader)
      : new Date();

  const bodyText = extractPlainText(data.payload).slice(0, 6000);

  return {
    id: messageId,
    subject,
    from,
    receivedAt,
    snippet: data.snippet ?? "",
    bodyText,
  };
}

/**
 * Sends a plain-text email via the Gmail API using the given connected
 * account's credentials.
 */
export async function sendEmail(
  account: ConnectedAccount,
  to: string,
  subject: string,
  body: string
) {
  const auth = await getAuthorizedClient(account);
  const gmail = google.gmail({ version: "v1", auth });

  const messageLines = [
    `From: ${account.email}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  const raw = Buffer.from(messageLines.join("\r\n")).toString("base64url");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}
