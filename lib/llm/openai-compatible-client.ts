/**
 * Sdílené volání OpenAI-kompatibilního chat API (Groq, Gemini, OpenRouter, …).
 */

export type OpenAiCompatConfig = {
  url: string;
  key?: string;
  model: string;
  label?: string;
};

/** Google AI Studio – OpenAI-kompatibilní endpoint pro Gemini. */
export const GEMINI_OPENAI_COMPAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export const GEMINI_DEFAULT_MODEL = "gemini-2.0-flash";

export function getLlmRequestTimeoutMs(): number {
  const raw =
    process.env.LLM_REQUEST_TIMEOUT_MS?.trim() ??
    process.env.OLLAMA_CHAT_TIMEOUT_MS?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 10_000) return Math.min(n, 3_600_000);
  }
  return 600_000;
}

export function resolveOpenAiCompatConfig(prefix: string, fallbackPrefix?: string): OpenAiCompatConfig | null {
  const read = (p: string, key: string) => process.env[`${p}_${key}`]?.trim() ?? "";

  const url = read(prefix, "OPENAI_COMPAT_URL") || (fallbackPrefix ? read(fallbackPrefix, "OPENAI_COMPAT_URL") : "");
  if (!url) return null;

  const key = read(prefix, "OPENAI_COMPAT_KEY") || (fallbackPrefix ? read(fallbackPrefix, "OPENAI_COMPAT_KEY") : "");
  const model =
    read(prefix, "OPENAI_COMPAT_MODEL") ||
    (fallbackPrefix ? read(fallbackPrefix, "OPENAI_COMPAT_MODEL") : "") ||
    "llama-3.3-70b-versatile";

  return { url, key: key || undefined, model };
}

export function resolvePersonalistikaCvFallbackConfig(): OpenAiCompatConfig | null {
  const key = process.env.PERSONALISTIKA_CV_EXTRACT_FALLBACK_OPENAI_COMPAT_KEY?.trim();
  if (!key) return null;

  const url =
    process.env.PERSONALISTIKA_CV_EXTRACT_FALLBACK_OPENAI_COMPAT_URL?.trim() ||
    GEMINI_OPENAI_COMPAT_URL;
  const model =
    process.env.PERSONALISTIKA_CV_EXTRACT_FALLBACK_OPENAI_COMPAT_MODEL?.trim() ||
    GEMINI_DEFAULT_MODEL;

  return { url, key, model, label: "gemini" };
}

export type LlmCallResult = {
  content: string;
  config: OpenAiCompatConfig;
  usedFallback: boolean;
  primaryError?: string;
};

/**
 * Zavolá primárního poskytovatele (Groq); při chybě automaticky zkusí Gemini zálohu, pokud je nastaven klíč.
 */
export async function callOpenAiCompatibleWithCvFallback(
  prompt: string,
  primary: OpenAiCompatConfig | null,
  fallback: OpenAiCompatConfig | null
): Promise<LlmCallResult> {
  const failures: string[] = [];

  if (primary?.url) {
    try {
      const content = await callOpenAiCompatibleChat(primary, prompt);
      return { content, config: primary, usedFallback: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`primární (${primary.model}): ${msg}`);
    }
  } else if (!fallback) {
    throw new Error(
      "Chybí PERSONALISTIKA_CV_EXTRACT_OPENAI_COMPAT_URL (Groq) i záložní Gemini klíč."
    );
  }

  if (fallback?.url && fallback.key) {
    try {
      const content = await callOpenAiCompatibleChat(fallback, prompt);
      return {
        content,
        config: fallback,
        usedFallback: true,
        primaryError: failures[0],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`záloha Gemini (${fallback.model}): ${msg}`);
    }
  } else if (failures.length) {
    throw new Error(
      `${failures[0]} Záložní Gemini není nastaveno (PERSONALISTIKA_CV_EXTRACT_FALLBACK_OPENAI_COMPAT_KEY).`
    );
  }

  throw new Error(`Všechny poskytovatelé selhaly: ${failures.join(" → ")}`);
}

export function parseJsonFromLlm(raw: string): unknown {
  const trimmed = raw.trim();
  const block = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = block ? block[1].trim() : trimmed;
  return JSON.parse(jsonStr);
}

export async function callOpenAiCompatibleChat(
  config: OpenAiCompatConfig,
  prompt: string
): Promise<string> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(getLlmRequestTimeoutMs()),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("API nevrátila obsah odpovědi.");
  return content;
}
