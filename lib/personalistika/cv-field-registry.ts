import type { ExtractedCvDraft } from "@/lib/personalistika/llm-extract-cv-draft";

export type CvFormFieldKey =
  | "title"
  | "first_name"
  | "last_name"
  | "date_of_birth"
  | "citizenship"
  | "address_street"
  | "address_number"
  | "address_city"
  | "address_zip"
  | "email"
  | "phone"
  | "position_id"
  | "education_level"
  | "education_details"
  | "courses"
  | "lang_en"
  | "lang_de"
  | "lang_fr"
  | "lang_ru"
  | "lang_pl"
  | "lang_other"
  | "employer_name"
  | "employer_address"
  | "position_description"
  | "work_type"
  | "possible_start"
  | "additional_notes"
  | "notes";

export type CvFormFieldMeta = {
  key: CvFormFieldKey;
  label: string;
  group: string;
  inputType: "text" | "select" | "date" | "textarea";
};

export const CV_FORM_FIELDS: CvFormFieldMeta[] = [
  { key: "title", label: "Titul", group: "Osobní údaje", inputType: "text" },
  { key: "first_name", label: "Jméno", group: "Osobní údaje", inputType: "text" },
  { key: "last_name", label: "Příjmení", group: "Osobní údaje", inputType: "text" },
  { key: "date_of_birth", label: "Datum narození", group: "Osobní údaje", inputType: "date" },
  { key: "citizenship", label: "Státní příslušnost", group: "Osobní údaje", inputType: "text" },
  { key: "address_street", label: "Ulice", group: "Adresa", inputType: "text" },
  { key: "address_number", label: "ČP", group: "Adresa", inputType: "text" },
  { key: "address_city", label: "Město", group: "Adresa", inputType: "text" },
  { key: "address_zip", label: "PSČ", group: "Adresa", inputType: "text" },
  { key: "email", label: "E-mail", group: "Kontakt", inputType: "text" },
  { key: "phone", label: "Mobil", group: "Kontakt", inputType: "text" },
  { key: "position_id", label: "Zájem o pozici", group: "Pozice", inputType: "select" },
  { key: "education_level", label: "Úroveň vzdělání", group: "Vzdělání", inputType: "select" },
  { key: "education_details", label: "Vzdělání (detail)", group: "Vzdělání", inputType: "textarea" },
  { key: "courses", label: "Kurzy / rekvalifikace", group: "Vzdělání", inputType: "textarea" },
  { key: "lang_en", label: "Angličtina", group: "Jazyky", inputType: "select" },
  { key: "lang_de", label: "Němčina", group: "Jazyky", inputType: "select" },
  { key: "lang_fr", label: "Francouzština", group: "Jazyky", inputType: "select" },
  { key: "lang_ru", label: "Ruština", group: "Jazyky", inputType: "select" },
  { key: "lang_pl", label: "Polština", group: "Jazyky", inputType: "select" },
  { key: "lang_other", label: "Další jazyky", group: "Jazyky", inputType: "textarea" },
  { key: "employer_name", label: "Zaměstnavatel", group: "Zaměstnání", inputType: "text" },
  { key: "employer_address", label: "Sídlo zaměstnavatele", group: "Zaměstnání", inputType: "text" },
  { key: "position_description", label: "Pracovní zkušenosti", group: "Zaměstnání", inputType: "textarea" },
  { key: "work_type", label: "Typ práce", group: "Pozice", inputType: "select" },
  { key: "possible_start", label: "Možný nástup", group: "Pozice", inputType: "text" },
  { key: "additional_notes", label: "Doplňující informace", group: "Poznámky", inputType: "textarea" },
  { key: "notes", label: "Interní poznámka", group: "Poznámky", inputType: "textarea" },
];

const FIELD_BY_KEY = new Map(CV_FORM_FIELDS.map((f) => [f.key, f]));

export type CvExtractFieldItem = {
  id: string;
  label: string;
  value: string;
  suggestedFormField: CvFormFieldKey | null;
  sourceKey: string;
};

const DRAFT_TO_FORM: Record<string, CvFormFieldKey> = {
  title: "title",
  first_name: "first_name",
  last_name: "last_name",
  date_of_birth: "date_of_birth",
  citizenship: "citizenship",
  address_street: "address_street",
  address_number: "address_number",
  address_city: "address_city",
  address_zip: "address_zip",
  email: "email",
  phone: "phone",
  position_id: "position_id",
  education_level: "education_level",
  education_details: "education_details",
  courses: "courses",
  lang_en: "lang_en",
  lang_de: "lang_de",
  lang_fr: "lang_fr",
  lang_ru: "lang_ru",
  lang_pl: "lang_pl",
  lang_other: "lang_other",
  employer_name: "employer_name",
  employer_address: "employer_address",
  position_description: "position_description",
  work_type: "work_type",
  possible_start: "possible_start",
  additional_notes: "additional_notes",
  notes: "notes",
};

const EXTRACT_SOURCE_LABELS: Record<string, string> = {
  title: "Titul",
  first_name: "Jméno",
  last_name: "Příjmení",
  date_of_birth: "Datum narození",
  citizenship: "Státní příslušnost",
  address_street: "Ulice",
  address_number: "ČP",
  address_city: "Město",
  address_zip: "PSČ",
  email: "E-mail",
  phone: "Telefon",
  position_id: "Pozice (ID)",
  education_level: "Vzdělání",
  education_details: "Vzdělání (detail)",
  courses: "Kurzy",
  lang_en: "Angličtina",
  lang_de: "Němčina",
  lang_fr: "Francouzština",
  lang_ru: "Ruština",
  lang_pl: "Polština",
  lang_other: "Další jazyky",
  employer_name: "Zaměstnavatel",
  employer_address: "Sídlo zaměstnavatele",
  position_description: "Pracovní zkušenosti",
  work_type: "Typ práce",
  possible_start: "Možný nástup",
  additional_notes: "Doplňující informace",
  notes: "Poznámka AI",
};

export function getCvFormFieldMeta(key: CvFormFieldKey): CvFormFieldMeta {
  return FIELD_BY_KEY.get(key)!;
}

export function draftToFieldItems(draft: ExtractedCvDraft): CvExtractFieldItem[] {
  const items: CvExtractFieldItem[] = [];

  for (const [sourceKey, formKey] of Object.entries(DRAFT_TO_FORM)) {
    const raw = draft[sourceKey as keyof ExtractedCvDraft];
    if (raw == null || raw === "") continue;
    const value = String(raw).trim();
    if (!value) continue;

    items.push({
      id: sourceKey,
      label: EXTRACT_SOURCE_LABELS[sourceKey] ?? sourceKey,
      value,
      suggestedFormField: formKey,
      sourceKey,
    });
  }

  return items;
}

export function buildSuggestedMapping(
  draft: ExtractedCvDraft
): Partial<Record<CvFormFieldKey, string>> {
  const mapping: Partial<Record<CvFormFieldKey, string>> = {};

  for (const [sourceKey, formKey] of Object.entries(DRAFT_TO_FORM)) {
    const raw = draft[sourceKey as keyof ExtractedCvDraft];
    if (raw == null || raw === "") continue;
    const value = String(raw).trim();
    if (!value) continue;
    mapping[formKey] = value;
  }

  if (draft.additional_notes) {
    const existing = mapping.additional_notes ?? "";
    mapping.additional_notes = existing
      ? `${existing}\n${draft.additional_notes}`
      : draft.additional_notes;
  }

  return mapping;
}

export function groupCvFormFields(): Map<string, CvFormFieldMeta[]> {
  const groups = new Map<string, CvFormFieldMeta[]>();
  for (const field of CV_FORM_FIELDS) {
    const list = groups.get(field.group) ?? [];
    list.push(field);
    groups.set(field.group, list);
  }
  return groups;
}

export const SOURCE_TEXT_UI_MAX = 25_000;

export function truncateSourceTextForUi(text: string): {
  sourceText: string;
  sourceTextTruncated: boolean;
} {
  if (text.length <= SOURCE_TEXT_UI_MAX) {
    return { sourceText: text, sourceTextTruncated: false };
  }
  return {
    sourceText: `${text.slice(0, SOURCE_TEXT_UI_MAX)}\n\n[… text zkrácen pro zobrazení …]`,
    sourceTextTruncated: true,
  };
}
