import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAdministerEquipment, canReadEquipment } from "@/lib/equipment/access";
import { logEquipmentAuditSafe } from "@/lib/equipment/audit";
import {
  activeLabelGridSpec,
  buildEquipmentLabelGridSettings,
  getEquipmentLabelGridSettings,
  listEquipmentLabelTemplates,
  setEquipmentLabelGridSettings,
} from "@/lib/equipment/label-grid-settings";
import { labelGridFitError, labelsPerPage } from "@/lib/equipment/label-layout";

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
  const activeSpec = activeLabelGridSpec(settings);

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
  const next = buildEquipmentLabelGridSettings({
    templateKey: typeof body.templateKey === "string" ? body.templateKey : undefined,
    useCustom: Boolean(body.useCustom),
    customSpec: body.customSpec && typeof body.customSpec === "object" ? body.customSpec : undefined,
    ownerText: body.ownerText,
  });
  const activeSpec = activeLabelGridSpec(next);
  const fitError = labelGridFitError(activeSpec);
  if (fitError) {
    return NextResponse.json({ error: fitError }, { status: 400 });
  }

  const previous = await getEquipmentLabelGridSettings();
  const settings = await setEquipmentLabelGridSettings(next, userId);
  await logEquipmentAuditSafe({
    userId,
    action: "label_grid_update",
    tableName: "system_settings",
    detail: settings,
    oldValues: previous,
  });

  return NextResponse.json({
    settings,
    templates: listEquipmentLabelTemplates(),
    activeSpec,
    labelsPerPage: labelsPerPage(activeSpec),
  });
}
