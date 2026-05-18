/** Čitelná zpráva pro klienta z chyb Prisma při práci s materiály. */
export function materialyCreateErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const code = String((e as { code: string }).code);
    if (code === "P2003") {
      return "Neplatná vazba na kategorii nebo podtyp. Ověřte, že v databázi běží migrace modulu materiálů (tabulky material_categories, materials).";
    }
    if (code === "P2002") {
      return "Duplicitní hodnota (např. kód) — zvolte jiný kód.";
    }
    const msg = (e as { meta?: { message?: string } }).meta?.message;
    if (typeof msg === "string" && msg.includes("Unknown column")) {
      return "Struktura databáze neodpovídá aplikaci. Spusťte chybějící migrace (např. certificate_valid_until, rozšíření materials).";
    }
  }
  if (e instanceof Error && e.message) {
    return e.message.length > 200 ? `${e.message.slice(0, 200)}…` : e.message;
  }
  return "Chyba při vytváření";
}
