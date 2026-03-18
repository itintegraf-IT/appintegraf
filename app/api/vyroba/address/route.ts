import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

const ADRESA_KEY = "ADRESA";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "read"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  try {
    const setting = await prisma.vyroba_settings.findUnique({
      where: { setting_key: ADRESA_KEY },
    });

    const address = setting?.setting_val ?? process.env.VYROBA_OUTPUT_PATH ?? "";

    return NextResponse.json({ address });
  } catch (error) {
    console.error("[GET /api/vyroba/address]", error);
    return NextResponse.json({ error: "Chyba při načítání adresy" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "vyroba", "write"))) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const address = typeof body.address === "string" ? body.address.trim() : "";

    await prisma.vyroba_settings.upsert({
      where: { setting_key: ADRESA_KEY },
      create: { setting_key: ADRESA_KEY, setting_val: address },
      update: { setting_val: address },
    });

    return NextResponse.json({ address });
  } catch (error) {
    console.error("[PUT /api/vyroba/address]", error);
    return NextResponse.json({ error: "Chyba při ukládání adresy" }, { status: 500 });
  }
}
