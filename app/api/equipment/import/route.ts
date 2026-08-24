import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAdministerEquipment } from "@/lib/equipment/access";
import {
  commitEquipmentImportWithContext,
  loadEquipmentImportContext,
  planFromExcelBuffer,
} from "@/lib/equipment/excel-import-apply";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat majetek" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) {
      return NextResponse.json({ error: "Nahrajte soubor Excel (.xlsx, .xls)" }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      return NextResponse.json({ error: "Povolené formáty: .xlsx, .xls" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const ctx = await loadEquipmentImportContext();
    const plan = planFromExcelBuffer(buf, ctx);
    if (plan.blocked) {
      return NextResponse.json(
        { error: plan.errors[0] || "Soubor nelze importovat", errors: plan.errors },
        { status: 400 }
      );
    }

    const result = await commitEquipmentImportWithContext(plan, ctx, userId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("equipment/import:", e);
    const message = e instanceof Error ? e.message : "Import se nezdařil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
