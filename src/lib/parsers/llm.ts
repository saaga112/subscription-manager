import type { BillingCycle, EmailInput, ParsedSubscription } from "./types";

const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "record_subscription",
    description: "Record the subscription/billing details found in the email.",
    parameters: {
      type: "object",
      properties: {
        isSubscriptionEmail: {
          type: "boolean",
          description: "True if this email is a subscription receipt, invoice, or renewal notice.",
        },
        serviceName: { type: "string", description: "Name of the service/company being billed." },
        amount: {
          type: ["number", "null"],
          description: "The amount charged or to be charged, as a plain number (no currency symbol).",
        },
        currency: {
          type: "string",
          description: "ISO 4217 currency code, e.g. USD, EUR, INR.",
        },
        billingCycle: {
          type: "string",
          enum: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "UNKNOWN"],
        },
        nextRenewalDate: {
          type: ["string", "null"],
          description: "Next renewal/billing date in YYYY-MM-DD format, or null if not mentioned.",
        },
        confidence: {
          type: "number",
          description: "Confidence in this extraction, between 0 and 1.",
        },
      },
      required: [
        "isSubscriptionEmail",
        "serviceName",
        "amount",
        "currency",
        "billingCycle",
        "nextRenewalDate",
        "confidence",
      ],
    },
  },
} as const;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-haiku-4.5";

interface ExtractionResult {
  isSubscriptionEmail: boolean;
  serviceName: string;
  amount: number | null;
  currency: string;
  billingCycle: BillingCycle;
  nextRenewalDate: string | null;
  confidence: number;
}

function getApiKey(): string | null {
  return process.env.OPENROUTER_API_KEY || null;
}

/**
 * Uses an OpenRouter-hosted model to extract subscription details from an
 * email. Returns `null` if no OPENROUTER_API_KEY is configured or the call
 * fails.
 */
export async function parseWithLLM(email: EmailInput): Promise<ParsedSubscription | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "function", function: { name: "record_subscription" } },
        messages: [
          {
            role: "user",
            content:
              "Extract subscription billing details from this email.\n\n" +
              `Subject: ${email.subject}\n` +
              `From: ${email.from}\n\n` +
              `Body:\n${email.bodyText || email.snippet}`.slice(0, 6000),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenRouter request failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "record_subscription") return null;

    const input = JSON.parse(toolCall.function.arguments) as ExtractionResult;

    if (!input.isSubscriptionEmail) {
      return {
        serviceName: input.serviceName || "Unknown Service",
        amount: null,
        currency: "USD",
        billingCycle: "UNKNOWN",
        nextRenewalDate: null,
        confidence: 0,
      };
    }

    return {
      serviceName: input.serviceName || "Unknown Service",
      amount: input.amount,
      currency: input.currency || "USD",
      billingCycle: input.billingCycle ?? "UNKNOWN",
      nextRenewalDate: input.nextRenewalDate,
      confidence: Math.min(Math.max(input.confidence ?? 0.5, 0), 1),
    };
  } catch (err) {
    console.error("LLM parsing failed:", err);
    return null;
  }
}

export function isLLMAvailable(): boolean {
  return getApiKey() !== null;
}
