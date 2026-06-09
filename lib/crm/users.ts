/** Výběr uživatele APPIntegraf pro CRM UI (avatar, owner picker). */
export const crmUserSelect = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
} as const;

export type CrmUserRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
};

export function crmUserDisplayName(u: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.email || "—";
}

export type CrmUserOption = {
  id: number;
  name: string;
  email: string;
  image: string | null;
};

/** Serializace pro client komponenty (Date → string). */
export function serializeCrmUser(u: CrmUserRow): CrmUserOption {
  return {
    id: u.id,
    name: crmUserDisplayName(u),
    email: u.email,
    image: null,
  };
}

export function serializeCrmUsers(users: CrmUserRow[]): CrmUserOption[] {
  return users.map(serializeCrmUser);
}

export function toMentionUser(u: CrmUserRow) {
  return { id: u.id, email: u.email, name: crmUserDisplayName(u) };
}
