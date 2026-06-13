import type { ParsingMode } from "@/generated/prisma/enums";
import { parseWithRules } from "./rules";
import { parseWithLLM, isLLMAvailable } from "./llm";
import type { EmailInput, ParsedSubscription } from "./types";

export type { ParsedSubscription, EmailInput } from "./types";
export { isLLMAvailable } from "./llm";

const HYBRID_CONFIDENCE_THRESHOLD = 0.6;

export interface ParseResult {
  data: ParsedSubscription | null;
  method: "RULE" | "LLM";
}

/**
 * Runs the configured parsing pipeline against an email.
 *
 * - RULE: regex/heuristic parsing only.
 * - LLM: try Claude first; fall back to rules if no API key or low confidence.
 * - HYBRID: try rules first; fall back to Claude only if rule confidence is low
 *   and an API key is configured.
 */
export async function parseEmail(email: EmailInput, mode: ParsingMode): Promise<ParseResult> {
  if (mode === "RULE") {
    return { data: parseWithRules(email), method: "RULE" };
  }

  if (mode === "LLM") {
    if (isLLMAvailable()) {
      const llmResult = await parseWithLLM(email);
      if (llmResult && llmResult.confidence > 0) {
        return { data: llmResult, method: "LLM" };
      }
    }
    return { data: parseWithRules(email), method: "RULE" };
  }

  // HYBRID
  const ruleResult = parseWithRules(email);
  if (ruleResult.confidence >= HYBRID_CONFIDENCE_THRESHOLD || !isLLMAvailable()) {
    return { data: ruleResult, method: "RULE" };
  }

  const llmResult = await parseWithLLM(email);
  if (llmResult && llmResult.confidence > ruleResult.confidence) {
    return { data: llmResult, method: "LLM" };
  }
  return { data: ruleResult, method: "RULE" };
}
