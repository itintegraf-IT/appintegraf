export type EmailSourceLabel = "osobní" | "oddělení" | "společná schránka";

export type MergedEmailRow = {
  address: string;
  sources: EmailSourceLabel[];
  /** Popisek u záznamu ve shared_mails (pokus role „společná schránka“) */
  sharedLabel: string | null;
};

function norm(e: string): string {
  return e.trim().toLowerCase();
}

function sourceRank(sources: EmailSourceLabel[]): number {
  if (sources.includes("osobní")) return 0;
  if (sources.includes("oddělení")) return 1;
  return 2;
}

/**
 * Sjednotí e-maily uživatele: přihlašovací, maily z oddělení (primární + vedlejší) a společné schránky.
 * Stejná adresa se vyskytne jednou se všemi zdroji (štítky v UI).
 */
export function mergeUserEmails(
  userEmail: string,
  departmentEmails: (string | null | undefined)[],
  shared: { email: string; label: string }[]
): MergedEmailRow[] {
  const m = new Map<string, { address: string; sources: Set<EmailSourceLabel>; sharedLabel: string | null }>();
  const add = (raw: string | null | undefined, s: EmailSourceLabel, shLabel: string | null) => {
    if (!raw || !String(raw).trim()) return;
    const t = String(raw).trim();
    const n = norm(t);
    const cur = m.get(n);
    if (!cur) {
      m.set(n, { address: t, sources: new Set([s]), sharedLabel: shLabel });
    } else {
      cur.sources.add(s);
      if (s === "společná schránka" && shLabel) cur.sharedLabel = shLabel;
    }
  };
  add(userEmail, "osobní", null);
  for (const de of departmentEmails) add(de, "oddělení", null);
  for (const sh of shared) add(sh.email, "společná schránka", sh.label);
  return Array.from(m.values())
    .map((v) => ({
      address: v.address,
      sources: [...v.sources] as EmailSourceLabel[],
      sharedLabel: v.sharedLabel,
    }))
    .sort((a, b) => {
      const r = sourceRank(a.sources) - sourceRank(b.sources);
      if (r !== 0) return r;
      return a.address.localeCompare(b.address, "cs");
    });
}
