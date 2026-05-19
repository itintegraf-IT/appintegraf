import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { assertValidUnitAssignment } from "@/lib/iml-customer-unit-rules";
import { normalizeTaxCountry, unitTypeLabel } from "@/lib/iml-customer-units";
import {
  parseIncomingContacts,
  parseIncomingEmails,
  pickLegacyContactPerson,
  pickLegacyEmailFromNested,
  pickLegacyPhoneFromContacts,
  syncCustomerContacts,
  syncCustomerEmails,
  validateNestedContacts,
  validateNestedEmails,
} from "@/lib/iml-customer-nested";
import {
  validateEmail,
  validateInternationalPhone,
  validateTaxIds,
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
  const scope = searchParams.get("scope") ?? "roots";

  const where: Record<string, unknown> = {};
  if (scope === "roots") {
    where.parent_id = null;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { contact_person: { contains: search } },
      { iml_customer_emails: { some: { email: { contains: search } } } },
    ];
  }

  if (scope === "units") {
    const units = await prisma.iml_customers.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {},
      orderBy: [{ parent_id: "asc" }, { sort_order: "asc" }, { name: "asc" }],
      take: 500,
      select: {
        id: true,
        name: true,
        unit_type: true,
        parent_id: true,
        parent: { select: { id: true, name: true } },
      },
    });
    const customers = units.map((u) => ({
      id: u.id,
      name: u.parent
        ? `${u.parent.name} → ${u.name} (${unitTypeLabel(u.unit_type)})`
        : `${u.name} (${unitTypeLabel(u.unit_type)})`,
      unit_type: u.unit_type,
      parent_id: u.parent_id,
      display_name: u.name,
      parent_name: u.parent?.name ?? null,
    }));
    return NextResponse.json({ customers });
  }

  const customers = await prisma.iml_customers.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    take: 200,
    include: {
      _count: { select: { branches: true } },
      iml_customer_emails: {
        where: { is_primary: true },
        take: 1,
        select: { email: true, kind: true },
      },
    },
  });

  return NextResponse.json({
    customers: customers.map((c) => ({
      ...c,
      branches_count: c._count.branches,
      primary_email: c.iml_customer_emails[0]?.email ?? c.email,
    })),
  });
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
      tax_country = null,
      ico = null,
      dic = null,
      label_requirements = null,
      pallet_packaging = null,
      prepress_notes = null,
      parent_id = null,
      unit_type = "standalone",
      sort_order = 0,
      emails: emailsRaw,
      contacts: contactsRaw,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Vyplňte název zákazníka", field: "name" }, { status: 400 });
    }

    const taxCountry = normalizeTaxCountry(tax_country);
    const emailV = validateEmail(email);
    if (!emailV.ok) {
      return NextResponse.json({ error: emailV.error, field: "email" }, { status: 400 });
    }
    const phoneV = validateInternationalPhone(phone, (taxCountry ?? "CZ") as "CZ");
    if (!phoneV.ok) {
      return NextResponse.json({ error: phoneV.error, field: "phone" }, { status: 400 });
    }
    const { ico: icoV, dic: dicV } = validateTaxIds(taxCountry, ico, dic);
    if (!icoV.ok) {
      return NextResponse.json({ error: icoV.error, field: "ico" }, { status: 400 });
    }
    if (!dicV.ok) {
      return NextResponse.json({ error: dicV.error, field: "dic" }, { status: 400 });
    }

    const parentIdParsed =
      parent_id != null && parent_id !== "" ? parseInt(String(parent_id), 10) : null;
    const unitCheck = await assertValidUnitAssignment({
      unitType: unit_type,
      parentId: Number.isNaN(parentIdParsed) ? null : parentIdParsed,
    });
    if (!unitCheck.ok) {
      return NextResponse.json({ error: unitCheck.error, field: "parent_id" }, { status: 400 });
    }

    const incomingEmails = parseIncomingEmails(emailsRaw);
    const emailsValidated = await validateNestedEmails(incomingEmails);
    if (!emailsValidated.ok) {
      return NextResponse.json(
        { error: emailsValidated.error, field: emailsValidated.field },
        { status: 400 }
      );
    }

    const incomingContacts = parseIncomingContacts(contactsRaw);
    const contactsValidated = await validateNestedContacts(incomingContacts);
    if (!contactsValidated.ok) {
      return NextResponse.json(
        { error: contactsValidated.error, field: contactsValidated.field },
        { status: 400 }
      );
    }

    const legacyEmail =
      emailV.value ??
      pickLegacyEmailFromNested(emailsValidated.rows);
    const legacyPhone =
      phoneV.value ?? pickLegacyPhoneFromContacts(contactsValidated.rows);
    const legacyContact =
      contact_person ? String(contact_person).trim() : pickLegacyContactPerson(contactsValidated.rows);

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.iml_customers.create({
        data: {
          name: String(name).trim(),
          email: legacyEmail,
          phone: legacyPhone,
          contact_person: legacyContact,
          allow_under_over_delivery_percent:
            allow_under_over_delivery_percent != null
              ? parseFloat(allow_under_over_delivery_percent)
              : null,
          customer_note: customer_note ? String(customer_note).trim() : null,
          billing_address: billing_address ? String(billing_address).trim() : null,
          shipping_address: shipping_address ? String(shipping_address).trim() : null,
          individual_requirements: individual_requirements
            ? String(individual_requirements).trim()
            : null,
          city: city ? String(city).trim() : null,
          postal_code: postal_code ? String(postal_code).trim() : null,
          country: country ? String(country).trim() : "Česká republika",
          billing_company: billing_company ? String(billing_company).trim() : null,
          tax_country: taxCountry,
          ico: icoV.value,
          dic: dicV.value,
          label_requirements: label_requirements ? String(label_requirements).trim() : null,
          pallet_packaging: pallet_packaging ? String(pallet_packaging).trim() : null,
          prepress_notes: prepress_notes ? String(prepress_notes).trim() : null,
          parent_id: unitCheck.parentId,
          unit_type: unitCheck.unitType,
          sort_order: parseInt(String(sort_order), 10) || 0,
        },
      });

      if (emailsValidated.rows.length > 0) {
        await syncCustomerEmails(tx, created.id, emailsValidated.rows);
      } else if (legacyEmail) {
        await syncCustomerEmails(tx, created.id, [
          { email: legacyEmail, kind: "general", is_primary: true, sort_order: 0 },
        ]);
      }

      if (contactsValidated.rows.length > 0) {
        await syncCustomerContacts(tx, created.id, contactsValidated.rows);
      }

      return created;
    });

    await logImlAudit({
      userId,
      action: "create",
      tableName: "iml_customers",
      recordId: customer.id,
      newValues: { name: customer.name, email: customer.email, ico: customer.ico, unit_type: customer.unit_type },
    });

    return NextResponse.json({ success: true, id: customer.id });
  } catch (e) {
    console.error("IML customers POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření zákazníka" }, { status: 500 });
  }
}
