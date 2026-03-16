import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const user = await prisma.users.findUnique({
    where: { id: userId },
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
      last_login: true,
      created_at: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);

  try {
    const body = await req.json();
    const {
      first_name,
      last_name,
      email,
      phone = "",
      landline = "",
      landline2 = "",
      position = "",
      password_current = "",
      password_new = "",
    } = body;

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: "Vyplňte jméno, příjmení a e-mail" }, { status: 400 });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "Uživatel nenalezen" }, { status: 404 });
    }

    if (password_new) {
      if (!password_current) {
        return NextResponse.json({ error: "Zadejte současné heslo pro změnu" }, { status: 400 });
      }
      let valid = false;
      if (user.password_hash) {
        valid = await bcrypt.compare(password_current, user.password_hash);
      } else if (user.password_custom && password_current === user.password_custom) {
        valid = true;
      }
      if (!valid) {
        return NextResponse.json({ error: "Současné heslo není správné" }, { status: 400 });
      }
      if (password_new.length < 6) {
        return NextResponse.json({ error: "Nové heslo musí mít alespoň 6 znaků" }, { status: 400 });
      }
    }

    const emailExists = await prisma.users.findFirst({
      where: { email: email.trim(), id: { not: userId } },
    });
    if (emailExists) {
      return NextResponse.json({ error: "E-mail již používá jiný uživatel" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      first_name: String(first_name).trim(),
      last_name: String(last_name).trim(),
      email: String(email).trim(),
      phone: phone.trim() || null,
      landline: landline.trim() || null,
      landline2: landline2.trim() || null,
      position: position.trim() || null,
    };

    if (password_new) {
      updateData.password_hash = await bcrypt.hash(password_new, 10);
      updateData.password_custom = null;
    }

    await prisma.users.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Profile PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání profilu" }, { status: 500 });
  }
}
