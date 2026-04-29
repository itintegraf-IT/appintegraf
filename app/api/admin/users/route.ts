import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { createUserToken } from "@/lib/tokens";
import { sendAccountActivationEmail } from "@/lib/email";
import { logAuthAudit, getRequestIp } from "@/lib/auth-audit";
import { validatePassword } from "@/lib/password-policy";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { first_name: { contains: search } },
      { last_name: { contains: search } },
      { email: { contains: search } },
      { username: { contains: search } },
    ];
  }

  const users = await prisma.users.findMany({
    where,
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    take: 200,
    select: {
      id: true,
      username: true,
      email: true,
      first_name: true,
      last_name: true,
      phone: true,
      position: true,
      department_name: true,
      is_active: true,
      role_id: true,
      created_at: true,
      roles: { select: { name: true } },
      user_roles: { select: { module_access: true } },
    },
  });

  type UserRow = (typeof users)[number];
  const usersWithModules = users.map((u: UserRow) => {
    const ur = u.user_roles?.[0];
    let module_access: Record<string, string> = {};
    if (ur?.module_access) {
      try {
        const decoded = JSON.parse(ur.module_access);
        if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
          if (decoded.all === true) {
            module_access = {
              contacts: "admin",
              equipment: "admin",
              calendar: "admin",
              contracts: "admin",
              planovani: "admin",
              vyroba: "admin",
              kiosk: "admin",
              training: "admin",
              iml: "admin",
              ukoly: "admin",
              personalistika: "admin",
            };
          } else {
            module_access = decoded as Record<string, string>;
          }
        }
      } catch {
        // ignore
      }
    }
    const { user_roles: _, ...rest } = u;
    return { ...rest, module_access };
  });

  return NextResponse.json({ users: usersWithModules });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      username,
      email,
      first_name,
      last_name,
      phone = "",
      landline = "",
      landline2 = "",
      position = "",
      department_id = null,
      secondary_department_ids = [],
      role_id = null,
      module_access = {},
      is_active = true,
      display_in_list = true,
      password_custom,
      send_activation_email = false,
    } = body;

    if (!username || !email || !first_name || !last_name) {
      return NextResponse.json({ error: "Vyplňte povinná pole" }, { status: 400 });
    }

    const existing = await prisma.users.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: existing.username === username ? "Uživatelské jméno již existuje" : "E-mail již existuje" },
        { status: 400 }
      );
    }

    const roleIdNum = role_id != null ? parseInt(String(role_id), 10) : NaN;
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

    const qrCode = String(Math.floor(Math.random() * 1e12)).padStart(12, "0");

    const useActivation = !!send_activation_email;
    let passwordHash: string;
    if (useActivation) {
      // Uživatel si heslo nastaví přes aktivační link. Do password_hash ukládáme
      // dlouhý náhodný řetězec, který nepůjde uhádnout (login nebude fungovat, dokud se nenastaví nové heslo).
      passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    } else {
      if (!password_custom || typeof password_custom !== "string") {
        return NextResponse.json({ error: "Zadejte heslo nebo zvolte aktivační e-mail." }, { status: 400 });
      }
      const v = validatePassword(password_custom);
      if (!v.ok) {
        return NextResponse.json({ error: v.error ?? "Heslo neodpovídá politice." }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(password_custom, 10);
    }

    const deptIdNum = department_id != null ? parseInt(String(department_id), 10) : null;
    let department_name: string | null = null;
    if (deptIdNum) {
      const dept = await prisma.departments.findUnique({
        where: { id: deptIdNum },
        select: { name: true },
      });
      if (dept) department_name = dept.name;
    }

    const validSecondaryIds = (Array.isArray(secondary_department_ids) ? secondary_department_ids : [])
      .filter((d): d is number => typeof d === "number" && !isNaN(d) && d > 0)
      .slice(0, 2);

    const user = await prisma.users.create({
      data: {
        username: username.trim(),
        email: email.trim(),
        password_hash: passwordHash,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: phone.trim() || null,
        landline: landline.trim() || null,
        landline2: landline2.trim() || null,
        position: position.trim() || null,
        department_id: deptIdNum,
        department_name,
        role_id: roleIdNum,
        display_in_list: !!display_in_list,
        is_active: !!is_active,
        qr_code: qrCode,
      },
    });

    for (const deptId of validSecondaryIds) {
      if (deptId !== deptIdNum) {
        await prisma.user_secondary_departments.create({
          data: { user_id: user.id, department_id: deptId },
        });
      }
    }

    const shared_mail_ids = Array.isArray(body.shared_mail_ids)
      ? (body.shared_mail_ids as unknown[]).map((x) => parseInt(String(x), 10)).filter((n) => !isNaN(n) && n > 0)
      : [];
    if (shared_mail_ids.length) {
      const found = await prisma.shared_mails.findMany({
        where: { id: { in: shared_mail_ids } },
        select: { id: true },
      });
      for (const sm of found) {
        await prisma.user_shared_mails.create({
          data: { user_id: user.id, shared_mail_id: sm.id },
        });
      }
    }

    const isAdminRole = roleRow.name?.toLowerCase() === "admin";
    const moduleAccessJson = isAdminRole
      ? JSON.stringify({ all: true })
      : JSON.stringify(module_access as Record<string, string>);

    try {
      await prisma.user_roles.create({
        data: { user_id: user.id, role_id: roleIdNum, module_access: moduleAccessJson },
      });
    } catch {
      // ignore
    }

    let activationEmailed: boolean | null = null;
    if (useActivation) {
      try {
        const ip = await getRequestIp();
        const { token, expiresAt } = await createUserToken({
          userId: user.id,
          purpose: "account_activation",
          ip,
        });
        const admin = await prisma.users.findUnique({
          where: { id: userId },
          select: { first_name: true, last_name: true },
        });
        const invitedBy = admin
          ? `${admin.first_name} ${admin.last_name}`.trim()
          : null;
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
          userId,
          targetUserId: user.id,
          action: "account_activation_sent",
          details: { by_admin: true, on_create: true, emailed: sendRes.success },
        });
      } catch (e) {
        console.error("activation email on create failed:", e);
        activationEmailed = false;
      }
    }

    return NextResponse.json({
      success: true,
      id: user.id,
      qr_code: qrCode,
      activation_email_sent: activationEmailed,
    });
  } catch (e) {
    console.error("Admin user POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření uživatele" }, { status: 500 });
  }
}
