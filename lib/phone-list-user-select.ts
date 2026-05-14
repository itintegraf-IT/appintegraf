import { Prisma } from "@prisma/client";
import { mergeUserEmails, type MergedEmailRow } from "@/lib/merge-user-emails";

/** Výběr uživatele pro telefonní seznam včetně vazeb pro společné maily a oddělení. */
export const phoneListUserSelect = {
  id: true,
  first_name: true,
  last_name: true,
  phone: true,
  landline: true,
  landline2: true,
  email: true,
  position: true,
  department_name: true,
  department_id: true,
  qr_code: true,
  user_shared_mails: {
    where: {
      shared_mails: {
        OR: [{ is_active: true }, { is_active: null }],
      },
    },
    include: {
      shared_mails: { select: { id: true, email: true, label: true, is_active: true } },
    },
  },
  user_secondary_departments: {
    include: {
      departments: { select: { id: true, email: true, name: true } },
    },
  },
} satisfies Prisma.usersSelect;

const personalFieldsSelect = {
  personal_phone: true,
  personal_email: true,
} satisfies Prisma.usersSelect;

export const phoneListUserSelectWithPersonal = {
  ...phoneListUserSelect,
  ...personalFieldsSelect,
} satisfies Prisma.usersSelect;

export type UserWithPersonalInclude = Prisma.usersGetPayload<{
  select: typeof phoneListUserSelectWithPersonal;
}>;

/** Výběr uživatele pro telefonní seznam; u admina i osobní kontakt. */
export function getPhoneListUserSelect(includePersonal: boolean) {
  return includePersonal ? phoneListUserSelectWithPersonal : phoneListUserSelect;
}

export type UserWithInclude = Prisma.usersGetPayload<{ select: typeof phoneListUserSelect }>;

type PhoneListContact = ReturnType<typeof toPhoneListContact>;

/** Odstraní osobní pole z kontaktu (obrana v hloubce pro ne-admina). */
export function stripPersonalFromContact<T extends PhoneListContact>(c: T): T {
  const { personal_phone: _p, personal_email: _e, ...rest } = c as T & {
    personal_phone?: string | null;
    personal_email?: string | null;
  };
  return rest as T;
}

type DeptById = Record<number, { email: string | null } | undefined>;

/**
 * Sestaví pro jednoho uživatele sloučené e-maily (osobní / oddělení / společné) a odstraní vnořená Prisma data.
 * `u` může obsahovat další sloupce (např. role) — projdou do výsledku přes `...rest`.
 */
export function toPhoneListContact(
  u: UserWithInclude & { roles?: { name: string } | null; role_id?: number | null },
  primaryDeptById: DeptById
) {
  const deptEmails: (string | null)[] = [];
  if (u.department_id != null) {
    const p = primaryDeptById[u.department_id];
    if (p?.email) deptEmails.push(p.email);
  }
  for (const usd of u.user_secondary_departments ?? []) {
    const e = usd.departments?.email;
    if (e) deptEmails.push(e);
  }
  const shared: { email: string; label: string }[] = [];
  for (const usm of u.user_shared_mails ?? []) {
    const sm = usm.shared_mails;
    if (sm && (sm.is_active !== false)) {
      shared.push({ email: sm.email, label: sm.label });
    }
  }
  const { user_shared_mails, user_secondary_departments, department_id, ...rest } = u;
  return {
    ...rest,
    merged_emails: mergeUserEmails(u.email, deptEmails, shared),
  } as typeof rest & { merged_emails: MergedEmailRow[] };
}
