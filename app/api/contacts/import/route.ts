import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import bcrypt from "bcryptjs";

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
  if (!(await hasModuleAccess(userId, "contacts", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat kontakty" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const mapping = mappingStr ? (JSON.parse(mappingStr) as Record<string, number>) : null;
    if (!mapping || typeof mapping.email !== "number" || typeof mapping.first_name !== "number" || typeof mapping.last_name !== "number") {
      return NextResponse.json({ error: "Mapování musí obsahovat email, first_name, last_name" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV je prázdné nebo nemá data" }, { status: 400 });
    }

    const delimiter = lines[0].includes(";") ? ";" : ",";
    const dataRows = lines.slice(1).map((l) => parseCsvLine(l, delimiter));

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const get = (field: string) => {
        const idx = mapping[field];
        return idx != null && row[idx] != null ? String(row[idx]).trim() : "";
      };

      const email = get("email");
      const first_name = get("first_name");
      const last_name = get("last_name");
      const username = get("username") || email?.split("@")[0] || `user${Date.now()}_${i}`;

      if (!email || !first_name || !last_name) {
        errors.push(`Řádek ${i + 2}: Chybí povinná pole`);
        continue;
      }

      const existing = await prisma.users.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existing) {
        errors.push(`Řádek ${i + 2}: E-mail nebo username již existuje`);
        continue;
      }

      const passwordHash = await bcrypt.hash("heslo123", 10);
      const qrCode = String(Math.floor(Math.random() * 1e12)).padStart(12, "0");

      await prisma.users.create({
        data: {
          username,
          email,
          password_hash: passwordHash,
          first_name,
          last_name,
          phone: get("phone") || null,
          landline: get("landline") || null,
          landline2: get("landline2") || null,
          position: get("position") || null,
          department_name: get("department_name") || null,
          display_in_list: true,
          is_active: true,
          qr_code: qrCode,
        },
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
    console.error("Contacts import error:", e);
    return NextResponse.json({ error: "Chyba při importu" }, { status: 500 });
  }
}
