import {
  callOpenAiCompatibleWithCvFallback,
  parseJsonFromLlm,
  resolveOpenAiCompatConfig,
  resolvePersonalistikaCvFallbackConfig,
} from "@/lib/llm/openai-compatible-client";
import { EDUCATION_LEVELS, WORK_TYPES } from "@/lib/personalistika-db";

export type PositionForPrompt = { id: number; name: string };

export type ExtractedCvDraft = {
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  citizenship: string | null;
  address_street: string | null;
  address_number: string | null;
  address_city: string | null;
  address_zip: string | null;
  email: string | null;
  phone: string | null;
  position_id: number | null;
  education_level: string | null;
  education_details: string | null;
  courses: string | null;
  lang_en: string | null;
  lang_de: string | null;
  lang_fr: string | null;
  lang_ru: string | null;
  lang_pl: string | null;
  lang_other: string | null;
  employer_name: string | null;
  employer_address: string | null;
  position_description: string | null;
  work_type: string | null;
  possible_start: string | null;
  additional_notes: string | null;
  notes: string | null;
};

const MAX_TEXT = 28_000;
const EDUCATION_VALUES = new Set(EDUCATION_LEVELS.map((e) => e.value));
const WORK_TYPE_VALUES = new Set(WORK_TYPES.map((w) => w.value));
const LANG_LEVELS = new Set(["neumim", "zaklad", "stredni", "pokrocily"]);

const KNOWN_CV_JSON_KEYS = new Set([
  "title", "first_name", "last_name", "date_of_birth", "citizenship",
  "address_street", "address_number", "address_city", "address_zip",
  "email", "phone", "position_id", "education_level", "education_details", "courses",
  "lang_en", "lang_de", "lang_fr", "lang_ru", "lang_pl", "lang_other",
  "employer_name", "employer_address", "position_description", "work_type",
  "possible_start", "additional_notes", "notes",
]);

const LANG_FIELD_LABELS: Record<string, string> = {
  lang_en: "Angličtina",
  lang_de: "Němčina",
  lang_fr: "Francouzština",
  lang_ru: "Ruština",
  lang_pl: "Polština",
};

function joinAdditionalNotes(...parts: Array<string | null | undefined>): string | null {
  const merged = parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join("\n");
  return merged || null;
}

function truncateForLlm(text: string): string {
  if (text.length <= MAX_TEXT) return text;
  const half = Math.floor(MAX_TEXT / 2) - 100;
  return `${text.slice(0, half)}\n\n[… text zkrácen …]\n\n${text.slice(-half)}`;
}

function buildPrompt(cvText: string, positions: PositionForPrompt[]): string {
  const positionLines = positions.map((p) => `- id ${p.id}: ${p.name}`).join("\n");
  const educationLines = EDUCATION_LEVELS.map((e) => `- ${e.value} (${e.label})`).join("\n");
  const workTypeLines = WORK_TYPES.map((w) => `- ${w.value} (${w.label})`).join("\n");

  return `Jsi asistent pro personalistiku v české firmě. Z textu životopisu (CV) vyextrahuj údaje pro dotazník uchazeče.

Dostupné pracovní pozice (vyber nejvýše jedno position_id, které nejlépe sedí, jinak null):
${positionLines || "(žádné pozice – position_id: null)"}

Povolené hodnoty education_level (přesně jedna z nich nebo null):
${educationLines}

Povolené hodnoty work_type (přesně jedna nebo null):
${workTypeLines}

Úrovně jazyků: neumim | zaklad | stredni | pokrocily (pro lang_en, lang_de, lang_fr, lang_ru, lang_pl).

Vrať POUZE platný JSON (žádný markdown) s klíči:
{
  "title": string | null,
  "first_name": string | null,
  "last_name": string | null,
  "date_of_birth": string | null,
  "citizenship": string | null,
  "address_street": string | null,
  "address_number": string | null,
  "address_city": string | null,
  "address_zip": string | null,
  "email": string | null,
  "phone": string | null,
  "position_id": number | null,
  "education_level": string | null,
  "education_details": string | null,
  "courses": string | null,
  "lang_en": string | null,
  "lang_de": string | null,
  "lang_fr": string | null,
  "lang_ru": string | null,
  "lang_pl": string | null,
  "lang_other": string | null,
  "employer_name": string | null,
  "employer_address": string | null,
  "position_description": string | null,
  "work_type": string | null,
  "possible_start": string | null,
  "additional_notes": string | null,
  "notes": string | null
}

Pravidla:
- Datum narození YYYY-MM-DD, pokud nejde určit, null.
- Telefon preferuj český formát, bez zbytečných mezer.
- education_details: stručný souhrn škol a oborů.
- courses: kurzy, rekvalifikace, certifikace.
- position_description: poslední / hlavní pracovní zkušenosti.
- additional_notes: SEM patří veškeré další informace z CV, které nemají vlastní pole (řidičský průkaz, hobby, reference, dovednosti, nejasné údaje, cokoli navíc). Slučuj sem i nejisté nebo nezařaditelné údaje.
- notes: nepoužívej – vše přesuň do additional_notes.
- Nevymýšlej údaje – neznámé = null (kromě additional_notes, kam dej i nezařaditelný text z CV).

Text životopisu:
---
${truncateForLlm(cvText)}
---
`;
}

function normalizeDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function normalizeLang(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const low = s.toLowerCase();
  if (LANG_LEVELS.has(low)) return low;
  return null;
}

function normalizeDraft(
  parsed: Record<string, unknown>,
  validPositionIds: Set<number>
): ExtractedCvDraft {
  let position_id: number | null = null;
  const rawId = parsed.position_id;
  if (typeof rawId === "number" && Number.isFinite(rawId) && validPositionIds.has(rawId)) {
    position_id = rawId;
  } else if (typeof rawId === "string" && rawId.trim()) {
    const n = parseInt(rawId.trim(), 10);
    if (Number.isFinite(n) && validPositionIds.has(n)) position_id = n;
  }

  const edu = str(parsed.education_level);
  const education_level =
    edu && (EDUCATION_VALUES as Set<string>).has(edu) ? edu : null;

  const wt = str(parsed.work_type);
  const work_type = wt && (WORK_TYPE_VALUES as Set<string>).has(wt) ? wt : null;

  const overflowNotes: string[] = [];

  if (edu && !education_level) {
    overflowNotes.push(`Vzdělání (nezařazeno): ${edu}`);
  }
  if (wt && !work_type) {
    overflowNotes.push(`Typ práce (nezařazeno): ${wt}`);
  }

  const rawPositionId = parsed.position_id;
  if (
    rawPositionId != null &&
    rawPositionId !== "" &&
    position_id == null
  ) {
    overflowNotes.push(`Zájem o pozici (nezařazeno): ${String(rawPositionId)}`);
  }

  for (const [key, label] of Object.entries(LANG_FIELD_LABELS)) {
    const raw = str(parsed[key]);
    const normalized = normalizeLang(parsed[key]);
    if (raw && !normalized) {
      overflowNotes.push(`${label} (nezařazeno): ${raw}`);
    }
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (KNOWN_CV_JSON_KEYS.has(key)) continue;
    const text = str(value);
    if (text) overflowNotes.push(`${key}: ${text}`);
  }

  const lang_en = normalizeLang(parsed.lang_en);
  const lang_de = normalizeLang(parsed.lang_de);
  const lang_fr = normalizeLang(parsed.lang_fr);
  const lang_ru = normalizeLang(parsed.lang_ru);
  const lang_pl = normalizeLang(parsed.lang_pl);

  const additional_notes = joinAdditionalNotes(
    str(parsed.additional_notes),
    str(parsed.notes),
    overflowNotes.length ? overflowNotes.join("\n") : null
  );

  return {
    title: str(parsed.title),
    first_name: str(parsed.first_name),
    last_name: str(parsed.last_name),
    date_of_birth: normalizeDate(parsed.date_of_birth),
    citizenship: str(parsed.citizenship),
    address_street: str(parsed.address_street),
    address_number: str(parsed.address_number),
    address_city: str(parsed.address_city),
    address_zip: str(parsed.address_zip),
    email: str(parsed.email),
    phone: str(parsed.phone),
    position_id,
    education_level,
    education_details: str(parsed.education_details),
    courses: str(parsed.courses),
    lang_en,
    lang_de,
    lang_fr,
    lang_ru,
    lang_pl,
    lang_other: str(parsed.lang_other),
    employer_name: str(parsed.employer_name),
    employer_address: str(parsed.employer_address),
    position_description: str(parsed.position_description),
    work_type,
    possible_start: str(parsed.possible_start),
    additional_notes,
    notes: null,
  };
}

export type ExtractCvDraftResult = {
  draft: ExtractedCvDraft;
  modelUsed: string;
  provider: string;
  usedFallback: boolean;
  primaryError?: string;
};

export async function extractCvDraftWithLlm(
  cvText: string,
  positions: PositionForPrompt[]
): Promise<ExtractCvDraftResult> {
  const primary =
    resolveOpenAiCompatConfig("PERSONALISTIKA_CV_EXTRACT", "CONTRACT_EXTRACT") ?? null;
  if (primary) primary.label = "groq";

  const fallback = resolvePersonalistikaCvFallbackConfig();

  if (!primary && !fallback) {
    throw new Error(
      "Chybí Groq (PERSONALISTIKA_CV_EXTRACT_OPENAI_COMPAT_*) i záložní Gemini klíč (PERSONALISTIKA_CV_EXTRACT_FALLBACK_OPENAI_COMPAT_KEY)."
    );
  }

  const prompt = buildPrompt(cvText, positions);
  const { content: raw, config, usedFallback, primaryError } =
    await callOpenAiCompatibleWithCvFallback(prompt, primary, fallback);

  let parsed: Record<string, unknown>;
  try {
    const j = parseJsonFromLlm(raw);
    if (!j || typeof j !== "object") throw new Error("Neplatná JSON odpověď.");
    parsed = j as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      e instanceof Error ? `Parsování odpovědi LLM selhalo: ${e.message}` : "Parsování odpovědi LLM selhalo."
    );
  }

  const validPositionIds = new Set(positions.map((p) => p.id));
  return {
    draft: normalizeDraft(parsed, validPositionIds),
    modelUsed: config.model,
    provider: config.label ?? (usedFallback ? "gemini" : "groq"),
    usedFallback,
    primaryError,
  };
}
