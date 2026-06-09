import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "@/lib/crm/errors";
import { logger } from "@/lib/crm/logger";

export type GenerateResult = {
  rawText: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    throw new AppError(
      "INTERNAL",
      "AI shrnutí není nakonfigurováno (chybí ANTHROPIC_API_KEY)."
    );
  }
  return new Anthropic({ apiKey });
}

export async function generateDealSummary(
  systemPrompt: string,
  userContent: string,
  model = process.env.CRM_AI_MODEL ?? "claude-sonnet-4-20250514"
): Promise<GenerateResult> {
  const start = Date.now();
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });
  const durationMs = Date.now() - start;

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";

  logger.info("[crm-ai/claude] generation done", {
    model,
    durationMs,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return {
    rawText,
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
