import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
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
    return NextResponse.json({ error: "Nemáte oprávnění importovat zákazníky" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const mapping = mappingStr ? (JSON.parse(mappingStr) as Record<string, number>) : null;
    if (!mapping || typeof mapping.name !== "number") {
      return NextResponse.json({ error: "Mapování musí obsahovat alespoň pole name" }, { status: 400 });
    }

    let dataRows: string[][];
    const ext = file.name.toLowerCase();
    if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer" });
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
      dataRows = (data as string[][]).slice(1).filter((r) => r.some((c) => c != null && String(c).trim()));
    } else {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        return NextResponse.json({ error: "CSV je prázdné nebo nemá data" }, { status: 400 });
      }
      const delimiter = lines[0].includes(";") ? ";" : ",";
      dataRows = lines.slice(1).map((l) => parseCsvLine(l, delimiter));
    }

    if (dataRows.length === 0) {
      return NextResponse.json({ error: "Soubor nemá žádná data k importu" }, { status: 400 });
    }

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const get = (field: string) => {
        const idx = mapping[field];
        return idx != null && row[idx] != null ? String(row[idx]).trim() : "";
      };

      const name = get("name");
      if (!name) {
        errors.push(`Řádek ${i + 2}: Chybí povinné pole name`);
        continue;
      }

      const email = get("email") || null;
      if (email) {
        const existing = await prisma.iml_customers.findFirst({ where: { email } });
        if (existing) {
          errors.push(`Řádek ${i + 2}: Zákazník s e-mailem ${email} již existuje`);
          continue;
        }
      }

      const customer = await prisma.iml_customers.create({
        data: {
          name,
          email: email || null,
          phone: get("phone") || null,
          contact_person: get("contact_person") || null,
          allow_under_over_delivery_percent: get("allow_under_over_delivery_percent")
            ? parseFloat(get("allow_under_over_delivery_percent"))
            : null,
          customer_note: get("customer_note") || null,
          billing_address: get("billing_address") || null,
          shipping_address: get("shipping_address") || null,
          individual_requirements: get("individual_requirements") || null,
          city: get("city") || null,
          postal_code: get("postal_code") || null,
          country: get("country") || "Česká republika",
        },
      });

      await logImlAudit({
        userId,
        action: "create",
        tableName: "iml_customers",
        recordId: customer.id,
        newValues: { name: customer.name, email: customer.email },
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
    console.error("IML customers import error:", e);
    return NextResponse.json({ error: "Chyba při importu" }, { status: 500 });
  }
}
