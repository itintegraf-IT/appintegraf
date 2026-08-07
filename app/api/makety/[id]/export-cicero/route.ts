import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  userCanOperateGrafikaAutomation,
  userCanViewMaketa,
} from "@/lib/makety-access";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { exportMaketyCiceroXml } from "@/lib/makety-cicero-export";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const maketaId = parseInt((await params).id, 10);
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }
  if (!(await userCanOperateGrafikaAutomation(userId, maketaId)).allowed) {
    return NextResponse.json(
      { error: "Export může spustit jen finální schvalovatel" },
      { status: 403 }
    );
  }

  try {
    const result = await exportMaketyCiceroXml(maketaId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      fileName: result.fileName,
      savedPath: result.savedPath,
      savedToDisk: result.savedPath != null,
      xml: result.xml,
    });
  } catch (e) {
    console.error("POST export-cicero", e);
    return NextResponse.json({ error: "Export selhal" }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const maketaId = parseInt((await params).id, 10);
  if (Number.isNaN(maketaId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, maketaId))) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  try {
    const result = await exportMaketyCiceroXml(maketaId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (e) {
    console.error("GET export-cicero", e);
    return NextResponse.json({ error: "Export selhal" }, { status: 500 });
  }
}
