/**
 * Most mezi appintegraf `users` (first_name/last_name, bez avataru) a tvarem
 * uživatele, který očekává UI modulu Projekty (portováno z PM: { name, image }).
 *
 * Všechny Prisma selecty/include na relaci `user` v modulu Projekty používají
 * `projektyUserSelect`; na hranici API/loaderu se řádek převede přes
 * `toDisplayUser` na tvar { id, email, name, image }. Tím zůstává nesoulad
 * schémat izolovaný v datové vrstvě a portované komponenty se nemění.
 */
export const projektyUserSelect = {
  id: true,
  email: true,
  first_name: true,
  last_name: true,
} as const;

export type ProjektyUserRow = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
};

export type DisplayUser = {
  id: number;
  email: string;
  name: string;
  image: string | null;
};

export function toDisplayUser(u: ProjektyUserRow): DisplayUser {
  return {
    id: u.id,
    email: u.email,
    name: `${u.first_name} ${u.last_name}`.trim(),
    image: null, // avatary appintegraf u projekty modulu neřeší → UI zobrazí iniciály
  };
}

/** Bezpečně převede nullable relaci (uploader/author/assignee). */
export function toDisplayUserOrNull(u: ProjektyUserRow | null | undefined): DisplayUser | null {
  return u ? toDisplayUser(u) : null;
}
