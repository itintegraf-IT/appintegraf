import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";
import { validatePassword } from "@/lib/password-policy";
import { logAuthAudit } from "@/lib/auth-audit";
import { parseStoredModuleAccess } from "@/lib/app-modules";
import { syncStitkyUserRolesFromModuleAccess } from "@/lib/stitky/sync-user-roles";
import {
  syncVehicleManagerRole,
  upsertPrimaryUserRole,
  userHasVehicleManagerRole,
} from "@/lib/sync-vehicle-manager-role";
import { VEHICLE_MANAGER_ROLE } from "@/lib/resource-reservation-types";
import {
  normalizeEmailNotifications,
  parseEmailNotifications,
  serializeEmailNotifications,
} from "@/lib/user-email-notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const user = await prisma.users.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      first_name: true,
      last_name: true,
      phone: true,
      landline: true,
      landline2: true,
      position: true,
      department_name: true,
      department_id: true,
      is_active: true,
      display_in_list: true,
      role_id: true,
      totp_enabled: true,
      created_at: true,
      email_notifications: true,
      roles: { select: { id: true, name: true } },
      user_roles: {
        select: { role_id: true, module_access: true, roles: { select: { name: true } } },
      },
      user_secondary_departments: {
        select: { department_id: true },
        orderBy: { id: "asc" },
      },
      user_shared_mails: { select: { shared_mail_id: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  const ur =
    user.user_roles?.find((row) => row.roles.name?.toLowerCase() !== VEHICLE_MANAGER_ROLE) ??
    user.user_roles?.[0];
  const module_access = ur?.module_access
    ? parseStoredModuleAccess(ur.module_access)
    : {};
  const roleId = ur?.role_id ?? user.role_id;
  const vehicle_manager = await userHasVehicleManagerRole(id);

  // Legacy: pokud má department_name ale ne department_id, zkusíme najít oddělení podle názvu
  let department_id = user.department_id;
  if (!department_id && user.department_name) {
    const dept = await prisma.departments.findFirst({
      where: { name: user.department_name },
      select: { id: true },
    });
    if (dept) department_id = dept.id;
  }

  const secondary_department_ids = (
    (user.user_secondary_departments ?? []) as Array<{ department_id: number }>
  ).map((sd) => sd.department_id);

  const shared_mail_ids = (user.user_shared_mails ?? []).map((m) => m.shared_mail_id);

  const { user_roles: _, user_secondary_departments: __, user_shared_mails: _us, email_notifications: emailNotifRaw, ...rest } = user;
  return NextResponse.json({
    ...rest,
    department_id,
    secondary_department_ids,
    shared_mail_ids,
    role_id: roleId,
    module_access,
    vehicle_manager,
    email_notifications: parseEmailNotifications(emailNotifRaw),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const adminId = parseInt(session.user.id, 10);
  if (!(await isAdmin(adminId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const bodyData = body as Record<string, unknown>;
    const first_name = bodyData.first_name as string;
    const last_name = bodyData.last_name as string;
    const email = bodyData.email as string;
    const phone = (bodyData.phone as string) ?? "";
    const landline = (bodyData.landline as string) ?? "";
    const landline2 = (bodyData.landline2 as string) ?? "";
    const position = (bodyData.position as string) ?? "";
    const department_id = bodyData.department_id != null ? parseInt(String(bodyData.department_id), 10) : null;
    const secondary_department_ids = (bodyData.secondary_department_ids as number[] | undefined) ?? [];
    const is_active = bodyData.is_active !== false;
    const display_in_list = bodyData.display_in_list !== false;
    const role_id = bodyData.role_id ?? null;
    const password_new = (bodyData.password_new as string) ?? "";
    const module_access = (bodyData.module_access as Record<string, string>) ?? {};
    const vehicle_manager = bodyData.vehicle_manager === true;
    const emailNotifications =
      bodyData.email_notifications !== undefined
        ? normalizeEmailNotifications(bodyData.email_notifications)
        : null;

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: "Vyplňte jméno, příjmení a e-mail" }, { status: 400 });
    }

    const emailExists = await prisma.users.findFirst({
      where: { email: email.trim(), id: { not: id } },
    });
    if (emailExists) {
      return NextResponse.json({ error: "E-mail již používá jiný uživatel" }, { status: 400 });
    }

    const roleIdNum = role_id != null ? parseInt(String(role_id), 10) : null;
    if (!roleIdNum || isNaN(roleIdNum)) {
      return NextResponse.json({ error: "Vyberte roli uživatele" }, { status: 400 });
    }
    const roleRow = await prisma.roles.findUnique({
      where: { id: roleIdNum },
      select: { id: true, name: true, is_active: true },
    });
    if (!roleRow || roleRow.is_active === false) {
      return NextResponse.json({ error: "Vybraná role neexistuje nebo není aktivní" }, { status: 400 });
    }

    // department_name se synchronizuje z hlavního oddělení
    let department_name: string | null = null;
    if (department_id) {
      const dept = await prisma.departments.findUnique({
        where: { id: department_id },
        select: { name: true },
      });
      if (dept) department_name = dept.name;
    }

    const validSecondaryIds = secondary_department_ids
      .filter((d): d is number => typeof d === "number" && !isNaN(d) && d > 0)
      .slice(0, 2); // max 2

    const updateData: Record<string, unknown> = {
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      email: String(email).trim(),
      phone: phone.trim() || null,
      landline: landline.trim() || null,
      landline2: landline2.trim() || null,
      position: position.trim() || null,
      department_id,
      department_name,
      is_active: !!is_active,
      display_in_list: !!display_in_list,
      role_id: roleIdNum,
    };

    if (emailNotifications) {
      updateData.email_notifications = serializeEmailNotifications(emailNotifications);
    }

    let passwordChanged = false;
    if (password_new) {
      const v = validatePassword(password_new);
      if (!v.ok) {
        return NextResponse.json(
          { error: v.error ?? "Heslo neodpovídá politice." },
          { status: 400 }
        );
      }
      updateData.password_hash = await bcrypt.hash(password_new, 10);
      updateData.password_custom = null;
      updateData.password_version = { increment: 1 };
      passwordChanged = true;
    }

    await prisma.users.update({
      where: { id },
      data: updateData,
    });

    if (passwordChanged) {
      await logAuthAudit({
        userId: adminId,
        targetUserId: id,
        action: "password_set_by_admin",
        details: {},
      });
    }

    // Sekundární oddělení – smazat stará a vytvořit nová
    await prisma.user_secondary_departments.deleteMany({ where: { user_id: id } });
    for (const deptId of validSecondaryIds) {
      if (deptId !== department_id) {
        await prisma.user_secondary_departments.create({
          data: { user_id: id, department_id: deptId },
        });
      }
    }

    if (bodyData.shared_mail_ids !== undefined) {
      const shared_mail_ids = Array.isArray(bodyData.shared_mail_ids)
        ? (bodyData.shared_mail_ids as unknown[]).map((x) => parseInt(String(x), 10)).filter((n) => !isNaN(n) && n > 0)
        : [];
      const found = await prisma.shared_mails.findMany({
        where: { id: { in: shared_mail_ids } },
        select: { id: true },
      });
      const validIds = found.map((f) => f.id);
      await prisma.user_shared_mails.deleteMany({ where: { user_id: id } });
      for (const sid of validIds) {
        await prisma.user_shared_mails.create({ data: { user_id: id, shared_mail_id: sid } });
      }
    }

    const isAdminRole = roleRow.name?.toLowerCase() === "admin";
    const moduleAccessJson = isAdminRole
      ? JSON.stringify({ all: true })
      : JSON.stringify(module_access);

    await upsertPrimaryUserRole(id, roleIdNum, moduleAccessJson);
    await syncVehicleManagerRole(id, vehicle_manager, roleIdNum);

    if (!isAdminRole) {
      await syncStitkyUserRolesFromModuleAccess(id, module_access);
    } else {
      await prisma.stitky_user_roles.deleteMany({ where: { user_id: id } });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin user PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}
