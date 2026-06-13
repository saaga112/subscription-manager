export type BillingCycle = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "UNKNOWN";

export interface ParsedSubscription {
  serviceName: string;
  amount: number | null;
  currency: string;
  billingCycle: BillingCycle;
  /** ISO date string (YYYY-MM-DD), or null if not found */
  nextRenewalDate: string | null;
  /** 0-1 confidence score */
  confidence: number;
}

export interface EmailInput {
  subject: string;
  from: string;
  bodyText: string;
  snippet: string;
}
