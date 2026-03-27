import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth-utils";
import {
  getContractResolverSettingsForAdmin,
  saveContractResolverSettings,
} from "@/lib/contracts/contract-resolver-settings";

/** GET – hodnoty pro administraci (včetně náhledu jmen a varování u neplatných ID). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const settings = await getContractResolverSettingsForAdmin();
  return NextResponse.json(settings);
}

/** PUT – uložení ID uživatelů (prázdný řetězec = vymazat klíč v nastavení). */
export async function PUT(req: NextRequest) {
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
    const result = await saveContractResolverSettings(
      {
        legal_user_id: body.legal_user_id,
        financial_user_id: body.financial_user_id,
        executive_user_id: body.executive_user_id,
      },
      userId
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const settings = await getContractResolverSettingsForAdmin();
    return NextResponse.json({ success: true, ...settings });
  } catch (e) {
    console.error("contract-resolver-settings PUT:", e);
    return NextResponse.json({ error: "Chyba při ukládání." }, { status: 500 });
  }
}
