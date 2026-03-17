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

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  return lines.map((l) => parseCsvLine(l, delimiter));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění importovat objednávky" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mappingStr = formData.get("mapping") as string | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Žádný soubor" }, { status: 400 });
    }

    const mapping = mappingStr ? (JSON.parse(mappingStr) as Record<string, number>) : null;
    const required = ["order_number", "customer_name", "order_date", "product_identifier", "quantity"];
    for (const field of required) {
      if (!mapping || typeof mapping[field] !== "number" || mapping[field] < 0) {
        return NextResponse.json(
          { error: `Mapování musí obsahovat pole: ${required.join(", ")}` },
          { status: 400 }
        );
      }
    }
    const map = mapping as Record<string, number>;

    const get = (row: string[], field: string) => {
      const idx = map[field];
      return idx != null && row[idx] != null ? String(row[idx]).trim() : "";
    };

    let rows: string[][];
    const ext = file.name.toLowerCase();
    if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer" });
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
      rows = data as string[][];
    } else {
      const text = await file.text();
      rows = parseCsv(text);
    }

    if (rows.length < 2) {
      return NextResponse.json({ error: "Soubor je prázdný nebo nemá data" }, { status: 400 });
    }

    const dataRows = rows.slice(1).filter((r) => r.some((c) => c && String(c).trim()));

    const customers = await prisma.iml_customers.findMany({ select: { id: true, name: true } });
    const customerByName = new Map(customers.map((c) => [c.name.toLowerCase().trim(), c.id]));

    const products = await prisma.iml_products.findMany({
      select: { id: true, ig_code: true, sku: true, client_name: true },
    });
    const productByIgCode = new Map(
      products.filter((p) => p.ig_code).map((p) => [p.ig_code!.toLowerCase().trim(), p.id])
    );
    const productBySku = new Map(
      products.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase().trim(), p.id])
    );
    const productByClientName = new Map(
      products.filter((p) => p.client_name).map((p) => [p.client_name!.toLowerCase().trim(), p.id])
    );

    const findProduct = (ident: string): number | null => {
      const s = ident.toLowerCase().trim();
      return productByIgCode.get(s) ?? productBySku.get(s) ?? productByClientName.get(s) ?? null;
    };

    type OrderKey = string;
    const orderItems = new Map<OrderKey, { customerName: string; orderDate: string; status: string; notes: string; items: { productId: number; quantity: number; unitPrice: number | null }[] }>();

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const orderNumber = get(row, "order_number");
      const customerName = get(row, "customer_name");
      const orderDate = get(row, "order_date");
      const productIdent = get(row, "product_identifier");
      const qtyStr = get(row, "quantity");
      const status = get(row, "status") || "nová";
      const notes = get(row, "notes");
      const unitPriceStr = get(row, "unit_price");

      if (!orderNumber || !customerName || !orderDate || !productIdent || !qtyStr) {
        errors.push(`Řádek ${i + 2}: Chybí povinná pole`);
        continue;
      }

      const customerId = customerByName.get(customerName);
      if (!customerId) {
        errors.push(`Řádek ${i + 2}: Zákazník "${customerName}" nenalezen`);
        continue;
      }

      const productId = findProduct(productIdent);
      if (!productId) {
        errors.push(`Řádek ${i + 2}: Produkt "${productIdent}" nenalezen`);
        continue;
      }

      const quantity = parseInt(qtyStr, 10);
      if (isNaN(quantity) || quantity <= 0) {
        errors.push(`Řádek ${i + 2}: Neplatné množství`);
        continue;
      }

      const unitPrice = unitPriceStr ? parseFloat(unitPriceStr.replace(",", ".")) : null;

      const key: OrderKey = `${orderNumber}|${customerName}|${orderDate}`;
      if (!orderItems.has(key)) {
        orderItems.set(key, {
          customerName,
          orderDate,
          status,
          notes,
          items: [],
        });
      }
      const ord = orderItems.get(key)!;
      ord.items.push({ productId, quantity, unitPrice: isNaN(unitPrice as number) ? null : unitPrice });
    }

    for (const [key, ord] of orderItems) {
      const [orderNumber] = key.split("|");
      const existing = await prisma.iml_orders.findFirst({ where: { order_number: orderNumber } });
      if (existing) {
        errors.push(`Objednávka "${orderNumber}" již existuje`);
        continue;
      }

      const customerId = customerByName.get(ord.customerName)!;
      const orderDate = new Date(ord.orderDate);
      if (isNaN(orderDate.getTime())) {
        errors.push(`Objednávka "${orderNumber}": Neplatné datum`);
        continue;
      }

      let totalSum = 0;
      const order = await prisma.$transaction(async (tx) => {
        const o = await tx.iml_orders.create({
          data: {
            customer_id: customerId,
            order_number: orderNumber,
            order_date: orderDate,
            status: ord.status,
            notes: ord.notes || null,
            total: null,
          },
        });

        for (const it of ord.items) {
          const unitPrice = it.unitPrice;
          const subtotal = unitPrice != null ? unitPrice * it.quantity : null;
          if (subtotal) totalSum += subtotal;
          await tx.iml_order_items.create({
            data: {
              order_id: o.id,
              product_id: it.productId,
              quantity: it.quantity,
              unit_price: unitPrice,
              subtotal,
            },
          });
        }

        return tx.iml_orders.update({
          where: { id: o.id },
          data: { total: totalSum > 0 ? totalSum : null },
        });
      });

      await logImlAudit({
        userId,
        action: "create",
        tableName: "iml_orders",
        recordId: order.id,
        newValues: { order_number: order.order_number, customer_id: customerId },
      });
      imported++;
    }

    return NextResponse.json({
      success: true,
      imported,
      errors: errors.slice(0, 30),
      totalErrors: errors.length,
    });
  } catch (e) {
    console.error("IML orders import error:", e);
    return NextResponse.json({ error: "Chyba při importu" }, { status: 500 });
  }
}
