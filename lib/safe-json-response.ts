/** Bezpečné parsování JSON z fetch odpovědi (prázdné tělo při 500 nepadne). */
export async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text?.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}
