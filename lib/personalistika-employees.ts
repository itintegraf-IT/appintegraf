import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  ensurePersonalistikaTables,
  parseChecklistJson,
  serializeChecklistJson,
  type ChecklistItem,
  type ChecklistMap,
  type ChecklistItemKey,
  type EmployeeRow,
} from "@/lib/personalistika-db";
import {
  CHECKLIST_LABELS,
  OFFBOARDING_KEYS,
  ONBOARDING_HR_KEYS,
  ONBOARDING_IT_KEYS,
  type EmploymentType,
} from "@/lib/personalistika-employee-types";
import { createUserToken } from "@/lib/tokens";
import { sendAccountActivationEmail } from "@/lib/email";
import { getRequestIp, logAuthAudit } from "@/lib/auth-audit";
import { getUsersWithModuleAccess } from "@/lib/auth-utils";

export function checklistItemLabel(key: ChecklistItemKey): string {
  return CHECKLIST_LABELS[key] ?? key;
}

export function emptyChecklistItem(): ChecklistItem {
  return { done: false, note: "", at: null, by: null };
}

export function mergeChecklistInput(
  incoming: unknown,
  prev: ChecklistMap,
  actorUserId: number
): ChecklistMap {
  const src =
    incoming && typeof incoming === "object" ? (incoming as Record<string, unknown>) : {};
  const out: ChecklistMap = { ...prev };
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(src)) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const prevItem = prev[key as ChecklistItemKey] ?? emptyChecklistItem();
    const done = !!item.done;
    const note = typeof item.note === "string" ? item.note : prevItem.note ?? "";
    const changed = done !== !!prevItem.done || note !== (prevItem.note ?? "");
    out[key as ChecklistItemKey] = {
      done,
      note,
      at: changed ? (done || note ? now : null) : prevItem.at ?? null,
      by: changed ? actorUserId : prevItem.by ?? null,
    };
  }
  return out;
}

function slugifyUsernamePart(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 40);
}

export async function allocateUsername(email: string, firstName: string, lastName: string): Promise<string> {
  const local = email.includes("@") ? email.split("@")[0] : "";
  const fromEmail = slugifyUsernamePart(local);
  const fromName = slugifyUsernamePart(`${firstName}.${lastName}`);
  let base = fromEmail || fromName || "user";
  if (base.length < 2) base = "user";

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`;
    const existing = await prisma.users.findFirst({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate.slice(0, 50);
  }
  return `${base}${Date.now()}`.slice(0, 50);
}

export async function ensureEmployeeUser(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  personalPhone?: string | null;
  personalEmail?: string | null;
  positionTitle?: string | null;
  departmentId?: number | null;
  /** Pošle aktivační e-mail (default true u nového účtu). */
  sendActivationEmail?: boolean;
  invitedByUserId?: number | null;
}): Promise<{ userId: number; created: boolean; activationEmailed: boolean | null }> {
  const email = params.email.trim().toLowerCase();
  const existing = await prisma.users.findFirst({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    await prisma.users.update({
      where: { id: existing.id },
      data: {
        first_name: params.firstName.trim(),
        last_name: params.lastName.trim(),
        phone: params.phone?.trim() || null,
        personal_phone: params.personalPhone?.trim() || null,
        personal_email: params.personalEmail?.trim() || null,
        position: params.positionTitle?.trim() || null,
        department_id: params.departmentId ?? undefined,
        is_active: true,
      },
    });
    return { userId: existing.id, created: false, activationEmailed: null };
  }

  const username = await allocateUsername(email, params.firstName, params.lastName);
  // Náhodné heslo — přihlášení až po aktivaci / nastavení hesla.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  const qrCode = String(Math.floor(Math.random() * 1e12)).padStart(12, "0");

  let departmentName: string | null = null;
  if (params.departmentId) {
    const dept = await prisma.departments.findUnique({
      where: { id: params.departmentId },
      select: { name: true },
    });
    departmentName = dept?.name ?? null;
  }

  const user = await prisma.users.create({
    data: {
      username,
      email,
      password_hash: passwordHash,
      first_name: params.firstName.trim(),
      last_name: params.lastName.trim(),
      phone: params.phone?.trim() || null,
      personal_phone: params.personalPhone?.trim() || null,
      personal_email: params.personalEmail?.trim() || null,
      position: params.positionTitle?.trim() || null,
      department_id: params.departmentId ?? null,
      department_name: departmentName,
      role_id: 1,
      display_in_list: false,
      qr_code: qrCode,
      is_active: true,
    },
  });

  try {
    await prisma.user_roles.create({
      data: { user_id: user.id, role_id: 1 },
    });
  } catch {
    // already exists
  }

  let activationEmailed: boolean | null = null;
  if (params.sendActivationEmail !== false) {
    try {
      const ip = await getRequestIp();
      const { token, expiresAt } = await createUserToken({
        userId: user.id,
        purpose: "account_activation",
        ip,
      });
      let invitedBy: string | null = null;
      if (params.invitedByUserId) {
        const admin = await prisma.users.findUnique({
          where: { id: params.invitedByUserId },
          select: { first_name: true, last_name: true },
        });
        invitedBy = admin ? `${admin.first_name} ${admin.last_name}`.trim() : null;
      }
      const sendRes = await sendAccountActivationEmail({
        toEmail: user.email,
        toName: `${user.first_name} ${user.last_name}`.trim() || user.username,
        username: user.username,
        token,
        expiresAt,
        invitedBy,
      });
      activationEmailed = sendRes.success;
      await logAuthAudit({
        userId: params.invitedByUserId ?? null,
        targetUserId: user.id,
        action: "account_activation_sent",
        details: { by_personalistika: true, on_create: true, emailed: sendRes.success },
      });
    } catch (e) {
      console.error("personalistika activation email failed:", e);
      activationEmailed = false;
    }
  }

  return { userId: user.id, created: true, activationEmailed };
}

export function computeOnboardingProgress(onboarding: ChecklistMap | null | undefined): {
  done: number;
  total: number;
} {
  const keys = [...ONBOARDING_HR_KEYS, ...ONBOARDING_IT_KEYS];
  const map = onboarding ?? {};
  const done = keys.filter((k) => !!map[k]?.done).length;
  return { done, total: keys.length };
}

export async function notifyItAboutNewThpEmployee(params: {
  actorUserId: number;
  employeeId: number;
  displayName: string;
}): Promise<void> {
  const recipients = await getUsersWithModuleAccess("equipment", "write");
  const filtered = recipients.filter((u) => u.id !== params.actorUserId);
  if (filtered.length === 0) return;
  await prisma.notifications.createMany({
    data: filtered.map((u) => ({
      user_id: u.id,
      title: "Nový THP zaměstnanec",
      message: `Personalistika založila THP: ${params.displayName}. Doplňte přístupy / majetek.`,
      link: `/personalistika`,
      type: "personalistika",
    })),
  });
}

export async function createEmployeeRecord(params: {
  actorUserId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  personalPhone?: string | null;
  personalEmail?: string | null;
  positionTitle?: string | null;
  positionId?: number | null;
  departmentId?: number | null;
  employmentType?: EmploymentType;
  startDate?: string | null;
  applicationId?: number | null;
  notes?: string | null;
  sendActivationEmail?: boolean;
}): Promise<{
  employeeId: number;
  userId: number;
  userCreated: boolean;
  activationEmailed: boolean | null;
}> {
  await ensurePersonalistikaTables();

  const employmentType = params.employmentType === "delnik" ? "delnik" : "thp";
  let positionTitle = params.positionTitle?.trim() || null;
  if (params.positionId && !positionTitle) {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT name FROM hr_positions WHERE id = ? LIMIT 1`,
      params.positionId
    )) as { name: string }[];
    positionTitle = rows[0]?.name ?? null;
  }

  const { userId, created, activationEmailed } = await ensureEmployeeUser({
    email: params.email,
    firstName: params.firstName,
    lastName: params.lastName,
    phone: params.phone,
    personalPhone: params.personalPhone,
    personalEmail: params.personalEmail,
    positionTitle,
    departmentId: params.departmentId ?? null,
    sendActivationEmail: params.sendActivationEmail,
    invitedByUserId: params.actorUserId,
  });

  const existingEmp = (await prisma.$queryRawUnsafe(
    `SELECT id FROM hr_employees WHERE user_id = ? LIMIT 1`,
    userId
  )) as { id: number }[];
  if (existingEmp[0]) {
    throw new Error("Pro tohoto uživatele už evidence zaměstnance existuje.");
  }

  if (params.applicationId) {
    const linked = (await prisma.$queryRawUnsafe(
      `SELECT id FROM hr_employees WHERE application_id = ? LIMIT 1`,
      params.applicationId
    )) as { id: number }[];
    if (linked[0]) {
      throw new Error("Tento uchazeč už byl přijat jako zaměstnanec.");
    }
  }

  const emptyJson = serializeChecklistJson({});
  await prisma.$executeRawUnsafe(
    `INSERT INTO hr_employees (
      user_id, application_id, first_name, last_name, email, phone, personal_phone, personal_email,
      position_title, position_id, department_id, employment_type, start_date, end_date, status, notes,
      onboarding_json, offboarding_json, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'active', ?, ?, ?, ?, ?)`,
    userId,
    params.applicationId ?? null,
    params.firstName.trim(),
    params.lastName.trim(),
    params.email.trim().toLowerCase(),
    params.phone?.trim() || null,
    params.personalPhone?.trim() || null,
    params.personalEmail?.trim() || null,
    positionTitle,
    params.positionId ?? null,
    params.departmentId ?? null,
    employmentType,
    params.startDate || null,
    params.notes?.trim() || null,
    emptyJson,
    emptyJson,
    params.actorUserId,
    params.actorUserId
  );

  const createdRows = (await prisma.$queryRawUnsafe(
    `SELECT id FROM hr_employees WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    userId
  )) as { id: number }[];
  const employeeId = createdRows[0]?.id;
  if (!employeeId) throw new Error("Zaměstnance se nepodařilo vytvořit.");

  if (employmentType === "thp") {
    await notifyItAboutNewThpEmployee({
      actorUserId: params.actorUserId,
      employeeId,
      displayName: `${params.lastName.trim()} ${params.firstName.trim()}`.trim(),
    });
  }

  return { employeeId, userId, userCreated: created, activationEmailed };
}

export async function syncEmployeeToUser(params: {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  personalPhone?: string | null;
  personalEmail?: string | null;
  positionTitle?: string | null;
  departmentId?: number | null;
  terminate?: boolean;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const conflict = await prisma.users.findFirst({
    where: { email, NOT: { id: params.userId } },
    select: { id: true },
  });
  if (conflict) {
    throw new Error("E-mail je již použit u jiného uživatele.");
  }

  await prisma.users.update({
    where: { id: params.userId },
    data: {
      first_name: params.firstName.trim(),
      last_name: params.lastName.trim(),
      email,
      phone: params.phone?.trim() || null,
      personal_phone: params.personalPhone?.trim() || null,
      personal_email: params.personalEmail?.trim() || null,
      position: params.positionTitle?.trim() || null,
      ...(params.departmentId !== undefined ? { department_id: params.departmentId } : {}),
      ...(params.terminate
        ? { is_active: false, display_in_list: false }
        : {}),
    },
  });
}

export async function listActiveEquipmentForUser(userId: number) {
  const rows = await prisma.equipment_assignments.findMany({
    where: { user_id: userId, returned_at: null },
    orderBy: { assigned_at: "desc" },
    include: {
      equipment_items: {
        select: {
          id: true,
          name: true,
          asset_tag: true,
          serial_number: true,
          status: true,
          equipment_categories: { select: { name: true, code: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    assignment_id: r.id,
    assigned_at: r.assigned_at,
    equipment_id: r.equipment_items.id,
    name: r.equipment_items.name,
    asset_tag: r.equipment_items.asset_tag,
    serial_number: r.equipment_items.serial_number,
    status: r.equipment_items.status,
    category_name: r.equipment_items.equipment_categories?.name ?? null,
    category_code: r.equipment_items.equipment_categories?.code ?? null,
  }));
}

export { isPhoneOrComputerEquipment } from "@/lib/personalistika-employee-types";

export async function syncEmployeesFromActiveUsers(actorUserId: number): Promise<{
  created: number;
  skipped: number;
}> {
  await ensurePersonalistikaTables();

  const activeUsers = await prisma.users.findMany({
    where: { is_active: true },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone: true,
      personal_phone: true,
      personal_email: true,
      position: true,
      department_id: true,
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  const existing = (await prisma.$queryRawUnsafe(
    `SELECT user_id FROM hr_employees`
  )) as { user_id: number }[];
  const existingIds = new Set(existing.map((r) => Number(r.user_id)));

  let created = 0;
  let skipped = 0;
  const emptyJson = serializeChecklistJson({});

  for (const u of activeUsers) {
    if (existingIds.has(u.id)) {
      skipped += 1;
      continue;
    }
    const email = (u.email ?? "").trim().toLowerCase();
    if (!email) {
      skipped += 1;
      continue;
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO hr_employees (
        user_id, application_id, first_name, last_name, email, phone, personal_phone, personal_email,
        position_title, department_id, employment_type, start_date, end_date, status, notes,
        onboarding_json, offboarding_json, created_by, updated_by
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'thp', NULL, NULL, 'active', NULL, ?, ?, ?, ?)`,
      u.id,
      u.first_name.trim(),
      u.last_name.trim(),
      email,
      u.phone?.trim() || null,
      u.personal_phone?.trim() || null,
      u.personal_email?.trim() || null,
      u.position?.trim() || null,
      u.department_id ?? null,
      emptyJson,
      emptyJson,
      actorUserId,
      actorUserId
    );
    existingIds.add(u.id);
    created += 1;
  }

  return { created, skipped };
}

export async function getEmployeeProtocol(
  employeeId: number,
  kind: "onboarding" | "offboarding"
) {
  await ensurePersonalistikaTables();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT * FROM hr_employees WHERE id = ? LIMIT 1`,
    employeeId
  )) as EmployeeRow[];
  const emp = rows[0];
  if (!emp) return null;

  const map = parseChecklistJson(
    kind === "onboarding" ? emp.onboarding_json : emp.offboarding_json
  );
  const checklist = OFFBOARDING_KEYS.map((key) => {
    const item = map[key] ?? { done: false, note: "" };
    return {
      key,
      label: checklistItemLabel(key),
      done: !!item.done,
      note: item.note ?? "",
    };
  });

  const equipment = await listActiveEquipmentForUser(emp.user_id);
  const startDate = emp.start_date
    ? typeof emp.start_date === "string"
      ? emp.start_date.slice(0, 10)
      : emp.start_date.toISOString().slice(0, 10)
    : null;
  const endDate = emp.end_date
    ? typeof emp.end_date === "string"
      ? emp.end_date.slice(0, 10)
      : emp.end_date.toISOString().slice(0, 10)
    : null;

  return {
    kind,
    employee: {
      id: emp.id,
      user_id: emp.user_id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone,
      position_title: emp.position_title,
      employment_type: emp.employment_type,
      status: emp.status,
      start_date: startDate,
      end_date: endDate,
      notes: emp.notes,
    },
    checklist,
    equipment,
  };
}

export async function getEmployeeExitProtocol(employeeId: number) {
  return getEmployeeProtocol(employeeId, "offboarding");
}

export async function getEmployeeOnboardingProtocol(employeeId: number) {
  return getEmployeeProtocol(employeeId, "onboarding");
}
