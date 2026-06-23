import { prisma } from "@/lib/db";
import { getUsersWithModuleAdmin } from "@/lib/auth-utils";
import {
  hasStitkyMistrFlag,
  hasStitkyTiskarFlag,
} from "@/lib/stitky-module-access-flags";
import type { StitkyUserRole } from "@/lib/stitky/constants";

export type StitkyNotifyChannel = "mailing" | "mistri";

function parseModuleAccessRecord(raw: string | null): Record<string, string> | null {
  if (raw == null) return null;
  try {
    const decoded = JSON.parse(raw) as unknown;
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(decoded as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

/** Záložní zdroj — přímo z module_access (když tabulka stitky_user_roles není syncnutá). */
async function userIdsFromModuleAccessFlags(flag: "tiskar" | "mistr"): Promise<number[]> {
  const ids = new Set<number>();
  const check = flag === "tiskar" ? hasStitkyTiskarFlag : hasStitkyMistrFlag;

  const userRolesData = await prisma.user_roles.findMany({
    where: { users: { is_active: true } },
    select: { module_access: true, user_id: true },
  });

  for (const ur of userRolesData) {
    const record = parseModuleAccessRecord(ur.module_access);
    if (record && check(record)) ids.add(ur.user_id);
  }

  const usersWithFallbackRole = await prisma.users.findMany({
    where: {
      is_active: true,
      role_id: { not: null },
      user_roles: { none: {} },
    },
    include: { roles: { select: { permissions: true } } },
  });

  for (const u of usersWithFallbackRole) {
    const record = parseModuleAccessRecord(u.roles?.permissions ?? null);
    if (record && check(record)) ids.add(u.id);
  }

  return [...ids];
}

/** Aktivní uživatelé s rolí TISKAR nebo MISTER (z tabulky syncované z adminu). */
async function userIdsFromStitkyRoles(roles: StitkyUserRole[]): Promise<number[]> {
  if (roles.length === 0) return [];

  const rows = await prisma.stitky_user_roles.findMany({
    where: { role: { in: roles } },
    include: { users: { select: { id: true, is_active: true } } },
  });

  return rows.filter((r) => r.users.is_active).map((r) => r.user_id);
}

/**
 * Příjemci in-app notifikací a e-mailů při zadání zakázky.
 * mailing → tiskaři + admin modulu; mistri → mistři.
 */
export async function collectStitkyNotifyUserIds(params: {
  channel: StitkyNotifyChannel;
  excludeUserId?: number;
}): Promise<number[]> {
  const ids = new Set<number>();

  if (params.channel === "mailing") {
    for (const id of await userIdsFromStitkyRoles(["TISKAR"])) ids.add(id);
    for (const id of await userIdsFromModuleAccessFlags("tiskar")) ids.add(id);
    for (const id of await getUsersWithModuleAdmin("stitky")) ids.add(id);
  } else {
    for (const id of await userIdsFromStitkyRoles(["MISTER"])) ids.add(id);
    for (const id of await userIdsFromModuleAccessFlags("mistr")) ids.add(id);
  }

  if (params.excludeUserId != null) ids.delete(params.excludeUserId);
  return [...ids];
}

export async function getStitkyExtraEmailRecipients(): Promise<string[]> {
  const row = await prisma.stitky_settings.findUnique({
    where: { key: "email_recipients" },
  });
  if (!row?.value) return [];
  return row.value
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** E-maily uživatelů s danou rolí + dodatečné adresy z nastavení. */
export async function collectStitkyEmailAddresses(params: {
  channel: StitkyNotifyChannel;
}): Promise<string[]> {
  const userIds = await collectStitkyNotifyUserIds({ channel: params.channel });
  const emails = new Set<string>();

  if (userIds.length > 0) {
    const users = await prisma.users.findMany({
      where: { id: { in: userIds }, is_active: true },
      select: { email: true },
    });
    for (const u of users) {
      if (u.email?.trim()) emails.add(u.email.trim());
    }
  }

  for (const extra of await getStitkyExtraEmailRecipients()) {
    emails.add(extra);
  }

  return [...emails];
}
