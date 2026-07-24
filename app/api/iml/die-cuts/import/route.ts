import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import {
  normalizeCustomerNameKey,
  parseSpreadsheetFromBuffer,
} from "@/lib/iml-product-import-parse";
import { dieCutToProductFields, parseDieCutBody } from "@/lib/iml/die-cuts";
import {
  rowToDieCutBody,
  validateDieCutImportMapping,
  type DieCutColumnMapping,
} from "@/lib/iml/die-cuts-import";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat výseky" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const mapping = mappingStr ? (JSON.parse(mappingStr) as DieCutColumnMapping) : null;
    const mappingError = validateDieCutImportMapping(mapping);
    if (mappingError) {
      return NextResponse.json({ error: mappingError }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const { dataRows } = parseSpreadsheetFromBuffer(buf, file.name);

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Soubor nemá žádná data k importu" }, { status: 400 });
    }

    const [customers, boxTypes] = await Promise.all([
      prisma.iml_customers.findMany({ select: { id: true, name: true } }),
      prisma.iml_box_types.findMany({
        where: { is_active: true },
        select: { id: true, code: true, name: true },
      }),
    ]);

    const customerByName = new Map(
      customers.map((c) => [normalizeCustomerNameKey(c.name), c.id])
    );
    const boxByCode = new Map(
      boxTypes.map((b) => [b.code.trim().toLowerCase(), b.id])
    );
    const boxByName = new Map(
      boxTypes.map((b) => [normalizeCustomerNameKey(b.name), b.id])
    );

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i].map((c) => (c != null ? String(c) : ""));
      const body = rowToDieCutBody(row, mapping!);

      const customerName =
        body.customer_name != null ? String(body.customer_name).trim() : "";
      if (customerName) {
        const cid = customerByName.get(normalizeCustomerNameKey(customerName));
        if (!cid) {
          errors.push(`Řádek ${i + 2}: Zákazník „${customerName}“ nenalezen`);
          continue;
        }
        body.customer_id = cid;
      }
      delete body.customer_name;

      const boxTypeRaw = body.box_type != null ? String(body.box_type).trim() : "";
      if (boxTypeRaw) {
        const bid =
          boxByCode.get(boxTypeRaw.toLowerCase()) ??
          boxByName.get(normalizeCustomerNameKey(boxTypeRaw));
        if (!bid) {
          errors.push(`Řádek ${i + 2}: Typ krabice „${boxTypeRaw}“ nenalezen`);
          continue;
        }
        body.box_type_id = bid;
      }
      delete body.box_type;

      const parsed = parseDieCutBody(body);

      if ("error" in parsed) {
        errors.push(`Řádek ${i + 2}: ${parsed.error}`);
        continue;
      }

      const existing = await prisma.iml_die_cuts.findUnique({
        where: { label_shape_code: parsed.label_shape_code },
      });

      if (existing) {
        const productFields = dieCutToProductFields(parsed);
        const updatedRow = await prisma.$transaction(async (tx) => {
          const next = await tx.iml_die_cuts.update({
            where: { id: existing.id },
            data: {
              ...parsed,
              labels_per_sheet:
                body.labels_per_sheet !== undefined
                  ? parsed.labels_per_sheet
                  : existing.labels_per_sheet,
            },
          });
          await tx.iml_products.updateMany({
            where: { die_cut_id: existing.id },
            data: {
              ...productFields,
              labels_per_sheet:
                body.labels_per_sheet !== undefined
                  ? productFields.labels_per_sheet
                  : existing.labels_per_sheet,
            },
          });
          return next;
        });

        await logImlAudit({
          userId,
          action: "update",
          tableName: "iml_die_cuts",
          recordId: existing.id,
          oldValues: existing as unknown as Record<string, unknown>,
          newValues: updatedRow as unknown as Record<string, unknown>,
        });
        updated++;
      } else {
        const createdRow = await prisma.iml_die_cuts.create({ data: parsed });
        await logImlAudit({
          userId,
          action: "create",
          tableName: "iml_die_cuts",
          recordId: createdRow.id,
          newValues: { label_shape_code: createdRow.label_shape_code },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      imported: created + updated,
      created,
      updated,
      errors: errors.slice(0, 20),
      totalErrors: errors.length,
    });
  } catch (e) {
    console.error("IML die-cuts import error:", e);
    return NextResponse.json({ error: "Chyba při importu" }, { status: 500 });
  }
}
