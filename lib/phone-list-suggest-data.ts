import { prisma } from "@/lib/db";

const MIN_LEN = 2;
const LIM_USER = 7;
const LIM_DEPT = 5;
const LIM_SHARED = 4;

export type PhoneListSuggestRow = {
  key: string;
  line1: string;
  line2?: string;
  apply: string;
};

export function getPhoneListSuggestionsSyncMinLen() {
  return MIN_LEN;
}

export async function buildPhoneListSuggestions(q: string): Promise<PhoneListSuggestRow[]> {
  if (q.trim().length < MIN_LEN) return [];

  const [users, depts, shared] = await Promise.all([
    prisma.users.findMany({
      where: {
        AND: [
          { OR: [{ is_active: true }, { is_active: null }] },
          { OR: [{ display_in_list: true }, { display_in_list: null }] },
          {
            OR: [
              { first_name: { contains: q } },
              { last_name: { contains: q } },
              { email: { contains: q } },
            ],
          },
        ],
      },
      take: LIM_USER,
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
      select: { id: true, first_name: true, last_name: true, email: true },
    }),
    prisma.departments.findMany({
      where: {
        AND: [
          { OR: [{ is_active: true }, { is_active: null }] },
          { OR: [{ display_in_list: true }, { display_in_list: null }] },
          {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
            ],
          },
        ],
      },
      take: LIM_DEPT,
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.shared_mails.findMany({
      where: {
        AND: [
          { OR: [{ is_active: true }, { is_active: null }] },
          {
            OR: [{ email: { contains: q } }, { label: { contains: q } }],
          },
        ],
      },
      take: LIM_SHARED,
      orderBy: [{ sort_order: "asc" }, { label: "asc" }],
      select: { id: true, email: true, label: true },
    }),
  ]);

  const suggestions: PhoneListSuggestRow[] = [];

  for (const u of users) {
    const apply = (u.email?.trim() || u.last_name || u.first_name).trim();
    if (!apply) continue;
    suggestions.push({
      key: `u-${u.id}`,
      line1: `${u.first_name} ${u.last_name}`.trim(),
      line2: u.email,
      apply,
    });
  }
  for (const d of depts) {
    const apply = (d.email?.trim() || d.name).trim();
    if (!apply) continue;
    suggestions.push({
      key: `d-${d.id}`,
      line1: d.name,
      line2: d.email || undefined,
      apply,
    });
  }
  for (const s of shared) {
    const apply = s.email.trim() || s.label;
    suggestions.push({
      key: `s-${s.id}`,
      line1: s.label,
      line2: s.email,
      apply,
    });
  }

  return suggestions.slice(0, 16);
}
