import { AppError } from "./errors";

export interface AresResult {
  ico: string;
  name: string;
  dic: string | null;
  address: string | null;
}

const ICO_RE = /^\d{8}$/;
const ENDPOINT = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";

interface AresRaw {
  ico?: string;
  obchodniJmeno?: string;
  dic?: string;
  sidlo?: { textovaAdresa?: string };
}

export async function lookupAres(ico: string): Promise<AresResult> {
  if (!ICO_RE.test(ico)) {
    throw new AppError("VALIDATION", "IČO musí mít 8 číslic.");
  }
  const res = await fetch(`${ENDPOINT}/${ico}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) {
    throw new AppError("NOT_FOUND", `Firma s IČO ${ico} nebyla v ARES nalezena.`);
  }
  if (!res.ok) {
    throw new AppError("INTERNAL", "ARES momentálně neodpovídá, zkus to znovu.");
  }
  const raw = (await res.json()) as AresRaw;
  return {
    ico: raw.ico ?? ico,
    name: raw.obchodniJmeno ?? "",
    dic: raw.dic ?? null,
    address: raw.sidlo?.textovaAdresa ?? null,
  };
}
