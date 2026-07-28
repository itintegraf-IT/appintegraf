import {
  type AnswerKey,
  type DifficultyKey,
  ANSWER_KEYS,
  difficultyFromLabel,
} from "./constants";

/**
 * Parser CSV importu otázek a výukových materiálů pro modul IT Školení.
 *
 * Podporuje:
 * - oddělovač `;` nebo `,` (autodetekce)
 * - mapování sloupců (ruční v UI, s automatickým návrhem podle názvů v hlavičce)
 * - více správných odpovědí („A, B“ → "A,B")
 * - detekci posunuté hlavičky (datové řádky mají o 1 sloupec víc, např. ID bez hlavičky)
 */

// ─── Nízkoúrovňové parsování ────────────────────────────────────────────────

export type RawCsv = {
  header: string[];
  rows: { line: number; cells: string[] }[];
  delimiter: string;
};

export function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

/**
 * CSV s víceřádkovými hodnotami v uvozovkách: spojí fyzické řádky do logických záznamů.
 */
function splitLogicalLines(text: string): { line: number; raw: string }[] {
  const physical = text.split(/\r?\n/);
  const result: { line: number; raw: string }[] = [];
  let buffer = "";
  let bufferStart = 0;

  const quoteCount = (s: string) => (s.match(/"/g) ?? []).length;

  for (let i = 0; i < physical.length; i++) {
    if (buffer === "") {
      buffer = physical[i];
      bufferStart = i + 1;
    } else {
      buffer += "\n" + physical[i];
    }
    if (quoteCount(buffer) % 2 === 0) {
      result.push({ line: bufferStart, raw: buffer });
      buffer = "";
    }
  }
  if (buffer !== "") result.push({ line: bufferStart, raw: buffer });
  return result;
}

export function parseCsvRaw(text: string): RawCsv | null {
  const cleaned = text.replace(/^\uFEFF/, "");
  const logical = splitLogicalLines(cleaned).filter((l) => l.raw.trim());
  if (logical.length === 0) return null;

  const delimiter = detectDelimiter(logical[0].raw);
  const header = parseCsvLine(logical[0].raw, delimiter);
  const rows = logical.slice(1).map((l) => ({
    line: l.line,
    cells: parseCsvLine(l.raw, delimiter),
  }));

  return { header, rows, delimiter };
}

// ─── Mapování sloupců – otázky ──────────────────────────────────────────────

export const QUESTION_FIELDS = [
  "category",
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_answer",
  "difficulty",
  "explanation",
  "source",
] as const;

export type QuestionField = (typeof QUESTION_FIELDS)[number];

/** Mapování pole → index sloupce v CSV (null = nemapováno) */
export type QuestionMapping = Partial<Record<QuestionField, number | null>>;

export const QUESTION_FIELD_LABELS: Record<QuestionField, string> = {
  category: "Kategorie / okruh",
  question: "Text otázky",
  option_a: "Možnost A",
  option_b: "Možnost B",
  option_c: "Možnost C",
  option_d: "Možnost D",
  correct_answer: "Správná odpověď (A–D, i více: „A, B“)",
  difficulty: "Obtížnost",
  explanation: "Vysvětlení",
  source: "Zdroj",
};

export const QUESTION_REQUIRED_FIELDS: QuestionField[] = [
  "category",
  "question",
  "option_a",
  "option_b",
  "correct_answer",
];

const QUESTION_COLUMN_ALIASES: Record<QuestionField, string[]> = {
  category: ["kategorie", "category", "okruh", "kod_kategorie", "category_code", "tema"],
  question: ["otazka", "question", "text", "zneni"],
  option_a: ["a", "moznost_a", "option_a", "odpoved_a"],
  option_b: ["b", "moznost_b", "option_b", "odpoved_b"],
  option_c: ["c", "moznost_c", "option_c", "odpoved_c"],
  option_d: ["d", "moznost_d", "option_d", "odpoved_d"],
  correct_answer: [
    "spravna",
    "spravna_odpoved",
    "spravne",
    "correct",
    "correct_answer",
    "answer",
  ],
  difficulty: ["obtiznost", "difficulty", "narocnost"],
  explanation: ["vysvetleni", "explanation", "pozn", "poznamka"],
  source: ["zdroj", "source"],
};

function normalizeHeaderCell(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Automatický návrh mapování podle názvů sloupců v hlavičce.
 * Pokud mají datové řádky o 1 buňku víc než hlavička (typicky číselný ID sloupec
 * bez hlavičky na začátku), indexy se posunou o +1.
 */
export function autoMapQuestionColumns(raw: RawCsv): QuestionMapping {
  const mapping: QuestionMapping = {};
  raw.header.forEach((cell, idx) => {
    const normalized = normalizeHeaderCell(cell);
    for (const field of QUESTION_FIELDS) {
      if (
        QUESTION_COLUMN_ALIASES[field].includes(normalized) &&
        mapping[field] === undefined
      ) {
        mapping[field] = idx;
      }
    }
  });

  const shift = detectHeaderShift(raw);
  if (shift > 0) {
    for (const field of QUESTION_FIELDS) {
      const idx = mapping[field];
      if (typeof idx === "number") mapping[field] = idx + shift;
    }
  }

  return mapping;
}

function detectHeaderShift(raw: RawCsv): number {
  if (raw.rows.length === 0) return 0;
  const headerLength = raw.header.length;
  const sample = raw.rows.slice(0, 20);
  const longer = sample.filter((r) => r.cells.length === headerLength + 1);
  if (longer.length < sample.length * 0.8) return 0;
  // Řádky mají o 1 sloupec víc – posun dává smysl, jen pokud první buňka vypadá jako pořadové číslo
  const firstNumeric = longer.filter((r) => /^\d+$/.test(r.cells[0] ?? ""));
  return firstNumeric.length >= longer.length * 0.8 ? 1 : 0;
}

// ─── Sestavení otázek podle mapování ────────────────────────────────────────

export type ParsedQuestionRow = {
  /** Číslo řádku v souboru (1-based, včetně hlavičky) */
  line: number;
  category: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string | null;
  option_d: string | null;
  /** První správná odpověď (kvůli enum sloupci v DB) */
  correct_answer: AnswerKey;
  /** Všechny správné odpovědi, setříděné, oddělené čárkou – např. "A,B" */
  correct_answers: string;
  difficulty: DifficultyKey | null;
  explanation: string | null;
  source: string | null;
};

export type CsvRowError = { line: number; message: string };

export type CsvParseResult = {
  rows: ParsedQuestionRow[];
  errors: CsvRowError[];
  /** Počet datových řádků (bez hlavičky a prázdných řádků) */
  totalRows: number;
};

/** Normalizace „A, B“ / „b;d“ → setříděné unikátní pole písmen. */
export function parseCorrectAnswers(value: string): AnswerKey[] | null {
  const letters = value
    .toUpperCase()
    .split(/[\s,;+/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (letters.length === 0) return null;
  const unique = [...new Set(letters)];
  if (!unique.every((l) => (ANSWER_KEYS as string[]).includes(l))) return null;
  return (unique as AnswerKey[]).sort();
}

export function buildQuestionsFromCsv(raw: RawCsv, mapping: QuestionMapping): CsvParseResult {
  for (const required of QUESTION_REQUIRED_FIELDS) {
    if (typeof mapping[required] !== "number") {
      return {
        rows: [],
        errors: [
          {
            line: 1,
            message: `Chybí mapování povinného pole „${QUESTION_FIELD_LABELS[required]}“`,
          },
        ],
        totalRows: raw.rows.length,
      };
    }
  }

  const rows: ParsedQuestionRow[] = [];
  const errors: CsvRowError[] = [];

  const get = (cells: string[], field: QuestionField): string => {
    const idx = mapping[field];
    return typeof idx === "number" && cells[idx] !== undefined ? cells[idx].trim() : "";
  };

  for (const row of raw.rows) {
    const lineNumber = row.line;
    const cells = row.cells;

    const category = get(cells, "category");
    const question = get(cells, "question");
    const optionA = get(cells, "option_a");
    const optionB = get(cells, "option_b");
    const optionC = get(cells, "option_c");
    const optionD = get(cells, "option_d");
    const correctRaw = get(cells, "correct_answer");
    const difficultyRaw = get(cells, "difficulty");
    const explanation = get(cells, "explanation");
    const source = get(cells, "source");

    const rowErrors: string[] = [];
    if (!category) rowErrors.push("chybí kategorie");
    if (!question) rowErrors.push("chybí text otázky");
    if (!optionA) rowErrors.push("chybí možnost A");
    if (!optionB) rowErrors.push("chybí možnost B");

    const correctList = parseCorrectAnswers(correctRaw);
    if (!correctList) {
      rowErrors.push(
        `správná odpověď musí být A/B/C/D, případně více oddělených čárkou (nalezeno „${correctRaw || "–"}“)`
      );
    } else {
      const optionByKey: Record<AnswerKey, string> = {
        A: optionA,
        B: optionB,
        C: optionC,
        D: optionD,
      };
      for (const key of correctList) {
        if (!optionByKey[key]) {
          rowErrors.push(`správná odpověď je ${key}, ale možnost ${key} je prázdná`);
        }
      }
    }

    let difficulty: DifficultyKey | null = null;
    if (difficultyRaw) {
      difficulty = difficultyFromLabel(difficultyRaw);
      if (!difficulty) {
        rowErrors.push(`neznámá obtížnost „${difficultyRaw}“ (povolené: snadná, střední, těžká)`);
      }
    }

    if (rowErrors.length > 0 || !correctList) {
      errors.push({ line: lineNumber, message: rowErrors.join("; ") });
      continue;
    }

    rows.push({
      line: lineNumber,
      category,
      question,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC || null,
      option_d: optionD || null,
      correct_answer: correctList[0],
      correct_answers: correctList.join(","),
      difficulty,
      explanation: explanation || null,
      source: source || null,
    });
  }

  return { rows, errors, totalRows: raw.rows.length };
}

/** Zpětně kompatibilní parsování s automatickým mapováním sloupců. */
export function parseQuestionsCsv(text: string): CsvParseResult {
  const raw = parseCsvRaw(text);
  if (!raw) {
    return { rows: [], errors: [{ line: 1, message: "Soubor je prázdný" }], totalRows: 0 };
  }
  const mapping = autoMapQuestionColumns(raw);
  const missing = QUESTION_REQUIRED_FIELDS.filter((f) => typeof mapping[f] !== "number");
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message:
            "Hlavička CSV musí obsahovat sloupce: kategorie, otazka, moznost_a, moznost_b, spravna_odpoved (volitelně moznost_c, moznost_d, obtiznost, vysvetleni, zdroj) – nebo použijte ruční mapování sloupců",
        },
      ],
      totalRows: raw.rows.length,
    };
  }
  return buildQuestionsFromCsv(raw, mapping);
}

// ─── Mapování sloupců – výukové materiály ───────────────────────────────────

export type MaterialMapping = {
  /** Index sloupce s kategorií (volitelné) */
  category: number | null;
  /** Index sloupce s názvem/tématem (povinné) */
  title: number | null;
  /** Indexy sloupců, které tvoří obsah (alespoň jeden) */
  content: number[];
  /** Index sloupce se zdrojem (volitelné) */
  source: number | null;
};

const MATERIAL_TITLE_ALIASES = ["tema", "tema_kapitola", "nazev", "title", "kapitola", "temakapitola"];
const MATERIAL_CATEGORY_ALIASES = ["kategorie", "category", "okruh"];
const MATERIAL_SOURCE_ALIASES = ["zdroj", "source"];

export function autoMapMaterialColumns(raw: RawCsv): MaterialMapping {
  const mapping: MaterialMapping = { category: null, title: null, content: [], source: null };
  const usedIndexes = new Set<number>();

  raw.header.forEach((cell, idx) => {
    const normalized = normalizeHeaderCell(cell);
    if (mapping.category === null && MATERIAL_CATEGORY_ALIASES.includes(normalized)) {
      mapping.category = idx;
      usedIndexes.add(idx);
      return;
    }
    if (
      mapping.title === null &&
      MATERIAL_TITLE_ALIASES.some((alias) => normalized === alias || normalized.startsWith(alias + "_"))
    ) {
      mapping.title = idx;
      usedIndexes.add(idx);
      return;
    }
    if (mapping.source === null && MATERIAL_SOURCE_ALIASES.includes(normalized)) {
      mapping.source = idx;
      usedIndexes.add(idx);
      return;
    }
    // ID sloupce nepatří do obsahu
    if (normalized === "id" || normalized === "cislo" || normalized === "poradi") {
      usedIndexes.add(idx);
    }
  });

  raw.header.forEach((_cell, idx) => {
    if (!usedIndexes.has(idx)) mapping.content.push(idx);
  });

  return mapping;
}

export type ParsedMaterialRow = {
  line: number;
  category: string | null;
  title: string;
  /** Obsah složený z mapovaných sloupců (s popisky podle hlavičky) */
  content: string;
  source: string | null;
};

export type MaterialParseResult = {
  rows: ParsedMaterialRow[];
  errors: CsvRowError[];
  totalRows: number;
};

export function buildMaterialsFromCsv(raw: RawCsv, mapping: MaterialMapping): MaterialParseResult {
  if (typeof mapping.title !== "number") {
    return {
      rows: [],
      errors: [{ line: 1, message: "Chybí mapování pole „Název / téma“" }],
      totalRows: raw.rows.length,
    };
  }
  if (!Array.isArray(mapping.content) || mapping.content.length === 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: "Vyberte alespoň jeden sloupec s obsahem" }],
      totalRows: raw.rows.length,
    };
  }

  const rows: ParsedMaterialRow[] = [];
  const errors: CsvRowError[] = [];

  for (const row of raw.rows) {
    const cells = row.cells;
    const title = (cells[mapping.title] ?? "").trim();
    if (!title) {
      errors.push({ line: row.line, message: "chybí název / téma" });
      continue;
    }

    const parts: string[] = [];
    for (const idx of mapping.content) {
      const value = (cells[idx] ?? "").trim();
      if (!value) continue;
      const label = (raw.header[idx] ?? `Sloupec ${idx + 1}`).trim();
      parts.push(mapping.content.length > 1 ? `${label}:\n${value}` : value);
    }

    if (parts.length === 0) {
      errors.push({ line: row.line, message: "všechny obsahové sloupce jsou prázdné" });
      continue;
    }

    rows.push({
      line: row.line,
      category:
        typeof mapping.category === "number" ? (cells[mapping.category] ?? "").trim() || null : null,
      title,
      content: parts.join("\n\n"),
      source: typeof mapping.source === "number" ? (cells[mapping.source] ?? "").trim() || null : null,
    });
  }

  return { rows, errors, totalRows: raw.rows.length };
}

/**
 * Seskupení naparsovaných řádků do výsledných materiálů.
 * mode "row" – každý řádek je samostatný materiál;
 * mode "category" – řádky stejné kategorie se spojí do jednoho materiálu.
 */
export function groupMaterials(
  rows: ParsedMaterialRow[],
  mode: "row" | "category"
): { category: string | null; title: string; content: string; source: string | null }[] {
  if (mode === "row") {
    return rows.map((r) => ({
      category: r.category,
      title: r.title,
      content: r.content,
      source: r.source,
    }));
  }

  const byCategory = new Map<string, ParsedMaterialRow[]>();
  for (const row of rows) {
    const key = row.category ?? "";
    const list = byCategory.get(key);
    if (list) list.push(row);
    else byCategory.set(key, [row]);
  }

  return [...byCategory.entries()].map(([category, list]) => ({
    category: category || null,
    title: category || list[0].title,
    content: list.map((r) => `## ${r.title}\n\n${r.content}`).join("\n\n---\n\n"),
    source: list.find((r) => r.source)?.source ?? null,
  }));
}

/** Vzorová šablona CSV ke stažení v UI. */
export const QUESTIONS_CSV_TEMPLATE = [
  "kategorie;otazka;moznost_a;moznost_b;moznost_c;moznost_d;spravna_odpoved;obtiznost;vysvetleni;zdroj",
  'BEZP;Co je phishing?;Podvodný e-mail vylákávající údaje;Typ antiviru;Šifrovací algoritmus;Síťový protokol;A;snadná;"Phishing je podvodná technika, cílem je vylákat citlivé údaje.";Interní směrnice',
  'BEZP;Které znaky jsou typické pro phishing? (vyberte 2);Časový tlak;Podezřelý odesílatel;Oficiální podpis;Žádné odkazy;"A, B";střední;;',
].join("\r\n");
