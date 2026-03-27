/**
 * Vytěžení strukturovaných polí z textu smlouvy přes LLM (Ollama nebo OpenAI-kompatibilní API).
 */

export type ContractTypeForPrompt = { id: number; name: string; code: string | null };

export type ExtractedContractDraft = {
  title: string | null;
  contract_number: string | null;
  party_company: string | null;
  party_contact: string | null;
  description: string | null;
  value_amount: string | null;
  value_currency: string | null;
  effective_from: string | null;
  valid_until: string | null;
  expires_at: string | null;
  contract_type_id: number | null;
  notes: string | null;
};

const MAX_TEXT = 28_000;

function truncateForLlm(text: string): string {
  if (text.length <= MAX_TEXT) return text;
  const half = Math.floor(MAX_TEXT / 2) - 100;
  return (
    text.slice(0, half) +
    "\n\n[… text zkrácen uprostřed …]\n\n" +
    text.slice(-half)
  );
}

function buildPrompt(contractText: string, types: ContractTypeForPrompt[]): string {
  const typeLines = types
    .map((t) => `- id ${t.id}: ${t.name}${t.code ? ` (kód ${t.code})` : ""}`)
    .join("\n");

  return `Jsi asistent pro evidenci smluv v české firmě. Z níže uvedeného textu smlouvy (může být neúplný nebo z formátovaného PDF) vyextrahuj údaje pro formulář.

Dostupné typy smlouvy v systému (vyber nejvýše jedno contract_type_id, které nejlépe sedí, jinak null):
${typeLines || "(žádné typy – vrať contract_type_id: null)"}

Vrať POUZE platný JSON objekt (žádný markdown) s těmito klíči:
{
  "title": string | null,
  "contract_number": string | null,
  "party_company": string | null,
  "party_contact": string | null,
  "description": string | null,
  "value_amount": string | null,
  "value_currency": string | null,
  "effective_from": string | null,
  "valid_until": string | null,
  "expires_at": string | null,
  "contract_type_id": number | null,
  "notes": string | null
}

Pravidla:
- Datumy preferuj ve formátu YYYY-MM-DD; pokud nejsou jisté, null.
- value_amount: číslo jako řetězec bez měny (např. "150000"), měnu dej do value_currency (např. "CZK").
- party_company: druhá strana / dodavatel / odběratel podle kontextu.
- notes: stručné poznámky pro kontrolu člověkem (co je nejasné).
- Pokud něco nejde určit, použij null.

Text smlouvy:
---
${truncateForLlm(contractText)}
---
`;
}

function parseJsonFromLlm(raw: string): unknown {
  const trimmed = raw.trim();
  const block = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = block ? block[1].trim() : trimmed;
  return JSON.parse(jsonStr);
}

function normalizeDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }
  return null;
}

function normalizeDraft(
  parsed: Record<string, unknown>,
  validTypeIds: Set<number>
): ExtractedContractDraft {
  const str = (k: string) => {
    const v = parsed[k];
    if (v == null || v === "") return null;
    return String(v).trim() || null;
  };

  let contract_type_id: number | null = null;
  const rawId = parsed.contract_type_id;
  if (typeof rawId === "number" && Number.isFinite(rawId) && validTypeIds.has(rawId)) {
    contract_type_id = rawId;
  } else if (typeof rawId === "string" && rawId.trim()) {
    const n = parseInt(rawId.trim(), 10);
    if (Number.isFinite(n) && validTypeIds.has(n)) contract_type_id = n;
  }

  return {
    title: str("title"),
    contract_number: str("contract_number"),
    party_company: str("party_company"),
    party_contact: str("party_contact"),
    description: str("description"),
    value_amount: str("value_amount"),
    value_currency: str("value_currency") ?? "CZK",
    effective_from: normalizeDate(parsed.effective_from),
    valid_until: normalizeDate(parsed.valid_until),
    expires_at: normalizeDate(parsed.expires_at),
    contract_type_id,
    notes: str("notes"),
  };
}

async function callOllama(prompt: string): Promise<string> {
  const base = (
    process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"
  ).replace(/\/$/, "");
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      format: "json",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Ollama HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error("Ollama nevrátila obsah odpovědi.");
  return content;
}

async function callOpenAiCompatible(prompt: string): Promise<string> {
  const url = process.env.CONTRACT_EXTRACT_OPENAI_COMPAT_URL?.trim();
  const key = process.env.CONTRACT_EXTRACT_OPENAI_COMPAT_KEY?.trim();
  const model = process.env.CONTRACT_EXTRACT_OPENAI_COMPAT_MODEL ?? "gpt-4o-mini";
  if (!url) throw new Error("Chybí CONTRACT_EXTRACT_OPENAI_COMPAT_URL.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("API nevrátila obsah odpovědi.");
  return content;
}

/**
 * Vybere poskytovatele: pokud je nastavené OpenAI-kompatibilní URL, použije ho, jinak Ollama.
 */
export async function extractContractDraftWithLlm(
  contractText: string,
  types: ContractTypeForPrompt[]
): Promise<ExtractedContractDraft> {
  const prompt = buildPrompt(contractText, types);
  const validIds = new Set(types.map((t) => t.id));

  const useCompat = Boolean(process.env.CONTRACT_EXTRACT_OPENAI_COMPAT_URL?.trim());
  const raw = useCompat ? await callOpenAiCompatible(prompt) : await callOllama(prompt);

  let parsed: Record<string, unknown>;
  try {
    const j = parseJsonFromLlm(raw);
    if (!j || typeof j !== "object") throw new Error("Neplatná JSON odpověď.");
    parsed = j as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      e instanceof Error
        ? `Parsování odpovědi LLM selhalo: ${e.message}`
        : "Parsování odpovědi LLM selhalo."
    );
  }

  return normalizeDraft(parsed, validIds);
}
