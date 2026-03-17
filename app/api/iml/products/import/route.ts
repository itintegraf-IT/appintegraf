import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        current += c;
      }
    } else if (c === delimiter) {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat produkty" }, { status: 403 });
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { first_name: true, last_name: true },
  });
  const editorName = user ? `${user.first_name} ${user.last_name}` : `user_${userId}`;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const mapping = mappingStr ? (JSON.parse(mappingStr) as Record<string, number>) : null;
    const hasIgCode = mapping && typeof mapping.ig_code === "number";
    const hasClientName = mapping && typeof mapping.client_name === "number";
    const hasIgShortName = mapping && typeof mapping.ig_short_name === "number";
    if (!mapping || (!hasIgCode && !hasClientName && !hasIgShortName)) {
      return NextResponse.json({ error: "Mapování musí obsahovat alespoň pole ig_code, client_name nebo ig_short_name" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV je prázdné nebo nemá data" }, { status: 400 });
    }

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const dataRows = lines.slice(1).map((l) => parseCsvLine(l, delimiter));

    const customers = await prisma.iml_customers.findMany({ select: { id: true, name: true } });
    const customerByName = new Map(customers.map((c) => [c.name.toLowerCase(), c.id]));

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const get = (field: string) => {
        const idx = mapping[field];
        return idx != null && row[idx] != null ? String(row[idx]).trim() : "";
      };

      const igCode = get("ig_code");
      const clientName = get("client_name") || get("ig_short_name");
      if (!igCode && !clientName) {
        errors.push(`Řádek ${i + 2}: Chybí ig_code nebo client_name`);
        continue;
      }

      const sku = get("sku") || null;
      if (sku) {
        const existing = await prisma.iml_products.findFirst({ where: { sku } });
        if (existing) {
          errors.push(`Řádek ${i + 2}: Produkt se SKU ${sku} již existuje`);
          continue;
        }
      }

      const customerName = get("customer_name");
      let customerId: number | null = null;
      if (customerName) {
        customerId = customerByName.get(customerName.toLowerCase()) ?? null;
      }

      const product = await prisma.iml_products.create({
        data: {
          customer_id: customerId,
          ig_code: igCode || null,
          ig_short_name: get("ig_short_name") || null,
          client_code: get("client_code") || null,
          client_name: clientName || null,
          requester: get("requester") || null,
          label_shape_code: get("label_shape_code") || null,
          product_format: get("product_format") || null,
          die_cut_tool_code: get("die_cut_tool_code") || null,
          assembly_code: get("assembly_code") || null,
          positions_on_sheet: get("positions_on_sheet") ? parseInt(get("positions_on_sheet"), 10) : null,
          pieces_per_box: get("pieces_per_box") ? parseInt(get("pieces_per_box"), 10) : null,
          pieces_per_pallet: get("pieces_per_pallet") ? parseInt(get("pieces_per_pallet"), 10) : null,
          foil_type: get("foil_type") || null,
          color_coverage: get("color_coverage") || null,
          print_note: get("print_note") || null,
          has_print_sample: get("has_print_sample").toLowerCase() === "ano" || get("has_print_sample") === "1",
          ean_code: get("ean_code") || null,
          production_notes: get("production_notes") || null,
          approval_status: get("approval_status") || null,
          item_status: get("item_status") || null,
          sku,
          last_edited_by: editorName,
          is_active: true,
        },
      });

      await logImlAudit({
        userId,
        action: "create",
        tableName: "iml_products",
        recordId: product.id,
        newValues: { ig_code: product.ig_code, client_name: product.client_name },
      });
      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      errors: errors.slice(0, 20),
      totalErrors: errors.length,
    });
  } catch (e) {
    console.error("IML products import error:", e);
    return NextResponse.json({ error: "Chyba při importu" }, { status: 500 });
  }
}
