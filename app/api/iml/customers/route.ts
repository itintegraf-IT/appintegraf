import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import {
  validateCzPhone,
  validateDic,
  validateEmail,
  validateIco,
} from "@/lib/iml-validation";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { contact_person: { contains: search } },
        ],
      }
    : {};

  const customers = await prisma.iml_customers.findMany({
    where,
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json({ customers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name,
      email = null,
      phone = null,
      contact_person = null,
      allow_under_over_delivery_percent = null,
      customer_note = null,
      billing_address = null,
      shipping_address = null,
      individual_requirements = null,
      city = null,
      postal_code = null,
      country = "Česká republika",
      billing_company = null,
      ico = null,
      dic = null,
      label_requirements = null,
      pallet_packaging = null,
      prepress_notes = null,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Vyplňte název zákazníka", field: "name" }, { status: 400 });
    }

    const emailV = validateEmail(email);
    if (!emailV.ok) {
      return NextResponse.json({ error: emailV.error, field: "email" }, { status: 400 });
    }
    const phoneV = validateCzPhone(phone);
    if (!phoneV.ok) {
      return NextResponse.json({ error: phoneV.error, field: "phone" }, { status: 400 });
    }
    const icoV = validateIco(ico);
    if (!icoV.ok) {
      return NextResponse.json({ error: icoV.error, field: "ico" }, { status: 400 });
    }
    const dicV = validateDic(dic);
    if (!dicV.ok) {
      return NextResponse.json({ error: dicV.error, field: "dic" }, { status: 400 });
    }

    if (emailV.value && (await prisma.iml_customers.findFirst({ where: { email: emailV.value } }))) {
      return NextResponse.json(
        { error: "Zákazník s tímto e-mailem již existuje", field: "email" },
        { status: 400 }
      );
    }

    const customer = await prisma.iml_customers.create({
      data: {
        name: String(name).trim(),
        email: emailV.value,
        phone: phoneV.value,
        contact_person: contact_person ? String(contact_person).trim() : null,
        allow_under_over_delivery_percent: allow_under_over_delivery_percent != null ? parseFloat(allow_under_over_delivery_percent) : null,
        customer_note: customer_note ? String(customer_note).trim() : null,
        billing_address: billing_address ? String(billing_address).trim() : null,
        shipping_address: shipping_address ? String(shipping_address).trim() : null,
        individual_requirements: individual_requirements ? String(individual_requirements).trim() : null,
        city: city ? String(city).trim() : null,
        postal_code: postal_code ? String(postal_code).trim() : null,
        country: country ? String(country).trim() : "Česká republika",
        billing_company: billing_company ? String(billing_company).trim() : null,
        ico: icoV.value,
        dic: dicV.value,
        label_requirements: label_requirements ? String(label_requirements).trim() : null,
        pallet_packaging: pallet_packaging ? String(pallet_packaging).trim() : null,
        prepress_notes: prepress_notes ? String(prepress_notes).trim() : null,
      },
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_customers",
      recordId: customer.id,
      newValues: { name: customer.name, email: customer.email, ico: customer.ico },
    });

    return NextResponse.json({ success: true, id: customer.id });
  } catch (e) {
    console.error("IML customers POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření zákazníka" }, { status: 500 });
  }
}
