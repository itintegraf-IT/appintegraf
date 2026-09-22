import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAdministerEquipment, canReadEquipment } from "@/lib/equipment/access";
import {
  getEquipmentLabelGridSettings,
  listEquipmentLabelTemplates,
  setEquipmentLabelGridSettings,
} from "@/lib/equipment/label-grid-settings";
import { labelsPerPage } from "@/lib/equipment/label-layout";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const settings = await getEquipmentLabelGridSettings();
  const activeSpec = settings.useCustom
    ? settings.customSpec
    : listEquipmentLabelTemplates().find((t) => t.key === settings.templateKey)?.spec ??
      settings.customSpec;

  return NextResponse.json({
    settings,
    templates: listEquipmentLabelTemplates(),
    activeSpec,
    labelsPerPage: labelsPerPage(activeSpec),
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAdministerEquipment(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const settings = await setEquipmentLabelGridSettings(
    {
      templateKey: typeof body.templateKey === "string" ? body.templateKey : undefined,
      useCustom: Boolean(body.useCustom),
      customSpec: body.customSpec && typeof body.customSpec === "object" ? body.customSpec : undefined,
    },
    userId
  );

  return NextResponse.json({
    settings,
    templates: listEquipmentLabelTemplates(),
    labelsPerPage: labelsPerPage(
      settings.useCustom
        ? settings.customSpec
        : listEquipmentLabelTemplates().find((t) => t.key === settings.templateKey)?.spec ??
            settings.customSpec
    ),
  });
}
