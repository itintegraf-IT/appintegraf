/** Validace veřejného formuláře požadavku na vybavení (bez přihlášení). Limity podle sloupců equipment_requests. */

/**
 * Skryté pole formuláře: člověk ho nevyplní, robot ano. Neutrální název, aby ho
 * automatické vyplňování prohlížeče nepovažovalo za firmu, web ani jméno.
 */
export const PUBLIC_REQUEST_HONEYPOT_FIELD = "ig_hp_7c1";

/** Vyplněná past (jakákoli neprázdná hodnota) = požadavek robota. */
export function isHoneypotTriggered(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = (body as Record<string, unknown>)[PUBLIC_REQUEST_HONEYPOT_FIELD];
  if (value == null || value === false) return false;
  return typeof value === "string" ? value.trim() !== "" : true;
}

/** Řídicí znaky a obrácení směru textu; v popisu jsou povolené tabulátor a řádky. */
const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;
const MULTI_LINE_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;

export type PublicEquipmentRequestInput = {
  requester_name: string;
  requester_email: string;
  requester_phone: string | null;
  department: string | null;
  position: string | null;
  equipment_type: string;
  description: string;
  priority: string;
};

type Field = keyof Omit<PublicEquipmentRequestInput, "priority">;

const FIELDS: Record<Field, { label: string; max: number; required: boolean }> = {
  requester_name: { label: "Jméno", max: 100, required: true },
  requester_email: { label: "E-mail", max: 100, required: true },
  requester_phone: { label: "Telefon", max: 20, required: false },
  department: { label: "Oddělení", max: 100, required: false },
  position: { label: "Pozice", max: 100, required: false },
  equipment_type: { label: "Typ vybavení", max: 100, required: true },
  description: { label: "Popis", max: 5000, required: true },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePublicEquipmentRequest(
  body: unknown
): { ok: true; data: PublicEquipmentRequestInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Neplatný požadavek." };
  }
  const raw = body as Record<string, unknown>;
  const values = {} as Record<Field, string>;

  for (const [key, rule] of Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][]) {
    const value = raw[key];
    if (value != null && typeof value !== "string") {
      return { ok: false, error: "Neplatný formát formuláře." };
    }
    const text = (value ?? "").trim();
    if (rule.required && !text) {
      return { ok: false, error: "Vyplňte jméno, e-mail, typ vybavení a popis." };
    }
    if (text.length > rule.max) {
      return { ok: false, error: `Pole „${rule.label}“ může mít nejvýše ${rule.max} znaků.` };
    }
    const forbidden = key === "description" ? MULTI_LINE_FORBIDDEN : SINGLE_LINE_FORBIDDEN;
    if (forbidden.test(text)) {
      return { ok: false, error: `Pole „${rule.label}“ obsahuje nepovolené znaky.` };
    }
    values[key] = text;
  }

  if (!EMAIL_RE.test(values.requester_email)) {
    return { ok: false, error: "Neplatný e-mail." };
  }

  return {
    ok: true,
    data: {
      requester_name: values.requester_name,
      requester_email: values.requester_email,
      requester_phone: values.requester_phone || null,
      department: values.department || null,
      position: values.position || null,
      equipment_type: values.equipment_type,
      description: values.description,
      priority: typeof raw.priority === "string" ? raw.priority : "st_edn_",
    },
  };
}
