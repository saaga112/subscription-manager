import type { BillingCycle, EmailInput, ParsedSubscription } from "./types";

/** Known sender domains mapped to a friendly service name. */
const KNOWN_SENDERS: Record<string, string> = {
  "netflix.com": "Netflix",
  "spotify.com": "Spotify",
  "disneyplus.com": "Disney+",
  "hulu.com": "Hulu",
  "hbomax.com": "Max",
  "max.com": "Max",
  "adobe.com": "Adobe Creative Cloud",
  "dropbox.com": "Dropbox",
  "github.com": "GitHub",
  "openai.com": "OpenAI",
  "notion.so": "Notion",
  "audible.com": "Audible",
  "nytimes.com": "The New York Times",
  "linkedin.com": "LinkedIn Premium",
  "icloud.com": "iCloud+",
  "apple.com": "Apple",
  "amazon.com": "Amazon",
  "amazon.in": "Amazon",
  "google.com": "Google",
  "youtube.com": "YouTube Premium",
};

const CURRENCY_SYMBOL_TO_CODE: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "₹": "INR",
  "¥": "JPY",
};

const CURRENCY_REGEX =
  /(?:USD|EUR|GBP|INR|JPY|CAD|AUD|\$|€|£|₹|¥)\s?(\d{1,3}(?:[,.\d]*\d)?(?:[.,]\d{1,2})?)/;

const MONTHS =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

const DATE_PATTERNS: RegExp[] = [
  // 12 January 2026 / Jan 12, 2026
  new RegExp(`\\b(${MONTHS}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})\\b`, "i"),
  new RegExp(`\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS}\\.?,?\\s+\\d{4})\\b`, "i"),
  // 2026-01-12
  /\b(\d{4}-\d{2}-\d{2})\b/,
  // 01/12/2026 or 1/12/2026
  /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
];

const RENEWAL_KEYWORDS =
  /(?:renews?|renewal|next billing|next payment|next charge|will be (?:billed|charged)|billing date|due date|valid until|expires? on)[^\n]{0,40}/i;

/**
 * Emails must contain explicit subscription/recurring-billing language to be
 * treated as a subscription. Without this gate, the broad Gmail search query
 * (which also matches newsletters, job alerts, travel and investment emails)
 * causes unrelated numbers/dates in those emails to be parsed as subscription
 * amounts and renewal dates.
 */
const SUBSCRIPTION_SIGNAL =
  /\b(subscription|subscrib\w*|recurring (?:payment|billing|charge)|auto-?renew\w*|renews?\b|membership|billing cycle|next billing)\b/i;

const PRICE_CONTEXT_KEYWORDS =
  /(?:total|amount (?:due|charged|paid)|you(?:'ve| have) been charged|subscription (?:price|fee|cost)|renews? (?:for|at)|price)[^\n]{0,40}/i;

const CYCLE_KEYWORDS: Array<[RegExp, BillingCycle]> = [
  [/\b(weekly|every week|per week|\/week)\b/i, "WEEKLY"],
  [/\b(monthly|every month|per month|\/month|\/mo\b)\b/i, "MONTHLY"],
  [/\b(quarterly|every 3 months|every quarter)\b/i, "QUARTERLY"],
  [/\b(yearly|annually|every year|per year|\/year|\/yr\b)\b/i, "YEARLY"],
];

function extractDomain(from: string): string | null {
  const match = from.match(/@([\w.-]+)/);
  if (!match) return null;
  const domain = match[1].toLowerCase();
  const parts = domain.split(".");
  if (parts.length > 2) {
    return parts.slice(-2).join(".");
  }
  return domain;
}

function extractDisplayName(from: string): string | null {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return null;
}

function guessServiceName(email: EmailInput): string {
  const domain = extractDomain(email.from);
  if (domain && KNOWN_SENDERS[domain]) {
    return KNOWN_SENDERS[domain];
  }
  const displayName = extractDisplayName(email.from);
  if (displayName) {
    return displayName.replace(/\s*(billing|payments?|receipts?|no-?reply)\s*/gi, "").trim() || displayName;
  }
  if (domain) {
    const base = domain.split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return "Unknown Service";
}

function parseAmount(text: string): { amount: number | null; currency: string } {
  const priceContext = text.match(PRICE_CONTEXT_KEYWORDS);
  const searchSpace = priceContext ? priceContext[0] + text.slice((priceContext.index ?? 0) + priceContext[0].length, (priceContext.index ?? 0) + priceContext[0].length + 40) : null;

  const match = (searchSpace && searchSpace.match(CURRENCY_REGEX)) || text.match(CURRENCY_REGEX);
  if (!match) return { amount: null, currency: "USD" };
  const rawAmount = match[1].replace(/,/g, "");
  const amount = parseFloat(rawAmount);
  const symbol = match[0].trim().slice(0, match[0].trim().length - match[1].length).trim();
  const currency = CURRENCY_SYMBOL_TO_CODE[symbol] ?? (/^[A-Z]{3}$/.test(symbol) ? symbol : "USD");
  return { amount: Number.isFinite(amount) ? amount : null, currency };
}

function parseDate(text: string): string | null {
  const renewalContext = text.match(RENEWAL_KEYWORDS);
  const searchSpace = renewalContext ? renewalContext[0] + text.slice(renewalContext.index ?? 0, (renewalContext.index ?? 0) + 80) : text;

  for (const pattern of DATE_PATTERNS) {
    const match = searchSpace.match(pattern) ?? text.match(pattern);
    if (match) {
      const parsed = new Date(match[1]);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
      }
    }
  }
  return null;
}

function parseBillingCycle(text: string): BillingCycle {
  const renewalContext = text.match(RENEWAL_KEYWORDS);
  const searchSpace = renewalContext ? renewalContext[0] + text.slice((renewalContext.index ?? 0) + renewalContext[0].length, (renewalContext.index ?? 0) + renewalContext[0].length + 40) : null;

  if (searchSpace) {
    for (const [pattern, cycle] of CYCLE_KEYWORDS) {
      if (pattern.test(searchSpace)) return cycle;
    }
  }
  for (const [pattern, cycle] of CYCLE_KEYWORDS) {
    if (pattern.test(text)) return cycle;
  }
  return "UNKNOWN";
}

/**
 * Rule-based extraction of subscription details from an email using
 * regex heuristics and a known-sender lookup table.
 */
export function parseWithRules(email: EmailInput): ParsedSubscription {
  const fullText = `${email.subject}\n${email.bodyText || email.snippet}`;

  if (!SUBSCRIPTION_SIGNAL.test(fullText)) {
    return {
      serviceName: guessServiceName(email),
      amount: null,
      currency: "USD",
      billingCycle: "UNKNOWN",
      nextRenewalDate: null,
      confidence: 0,
    };
  }

  const serviceName = guessServiceName(email);
  const { amount, currency } = parseAmount(fullText);
  const nextRenewalDate = parseDate(fullText);
  const billingCycle = parseBillingCycle(fullText);

  let confidence = 0;
  if (amount !== null) confidence += 0.4;
  if (nextRenewalDate !== null) confidence += 0.35;
  if (billingCycle !== "UNKNOWN") confidence += 0.15;
  if (serviceName !== "Unknown Service") confidence += 0.1;

  return {
    serviceName,
    amount,
    currency,
    billingCycle,
    nextRenewalDate,
    confidence: Math.min(confidence, 1),
  };
}
