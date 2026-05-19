import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { normalizeTaxCountry } from "@/lib/iml-customer-units";
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

/**
 * GET /api/iml/customers/[id]/branches – seznam poboček centrály včetně počtu doručovacích adres.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k modulu IML" }, { status: 403 });
  }

  const headquartersId = parseInt((await params).id, 10);
  if (isNaN(headquartersId)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const branches = await prisma.iml_customers.findMany({
    where: { parent_id: headquartersId, unit_type: "branch" },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      unit_type: true,
      city: true,
      postal_code: true,
      email: true,
      phone: true,
      contact_person: true,
      billing_address: true,
      _count: { select: { iml_customer_shipping_addresses: true } },
      iml_customer_emails: {
        where: { is_primary: true },
        take: 1,
        select: { email: true },
      },
    },
  });

  return NextResponse.json({
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      unit_type: b.unit_type,
      city: b.city,
      postal_code: b.postal_code,
      email: b.email,
      primary_email: b.iml_customer_emails[0]?.email ?? b.email,
      phone: b.phone,
      contact_person: b.contact_person,
      billing_address: b.billing_address,
      shipping_addresses_count: b._count.iml_customer_shipping_addresses,
    })),
  });
}

/**
 * POST /api/iml/customers/[id]/branches – vytvoří pobočku pod centrálou [id].
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění k úpravám IML" }, { status: 403 });
  }

  const headquartersId = parseInt((await params).id, 10);
  if (isNaN(headquartersId)) {
    return NextResponse.json({ error: "Neplatné ID centrály" }, { status: 400 });
  }

  const hq = await prisma.iml_customers.findUnique({
    where: { id: headquartersId },
    select: { id: true, unit_type: true, parent_id: true },
  });
  if (!hq) {
    return NextResponse.json({ error: "Centrála nenalezena" }, { status: 404 });
  }
  if (hq.parent_id != null) {
    return NextResponse.json({ error: "Pobočku lze vytvořit jen pod centrálou skupiny" }, { status: 400 });
  }
  if (hq.unit_type === "branch") {
    return NextResponse.json({ error: "Pobočka nemůže mít další pobočky" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const {
      name,
      email = null,
      phone = null,
      contact_person = null,
      tax_country = null,
      ico = null,
      dic = null,
      city = null,
      postal_code = null,
      country = "Česká republika",
      billing_address = null,
      billing_company = null,
      sort_order = 0,
      emails: emailsRaw,
      contacts: contactsRaw,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Vyplňte název pobočky", field: "name" }, { status: 400 });
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

    const emailsValidated = await validateNestedEmails(parseIncomingEmails(emailsRaw));
    if (!emailsValidated.ok) {
      return NextResponse.json(
        { error: emailsValidated.error, field: emailsValidated.field },
        { status: 400 }
      );
    }
    const contactsValidated = await validateNestedContacts(parseIncomingContacts(contactsRaw));
    if (!contactsValidated.ok) {
      return NextResponse.json(
        { error: contactsValidated.error, field: contactsValidated.field },
        { status: 400 }
      );
    }

    const legacyEmail = emailV.value ?? pickLegacyEmailFromNested(emailsValidated.rows);
    const legacyPhone = phoneV.value ?? pickLegacyPhoneFromContacts(contactsValidated.rows);
    const legacyContact =
      contact_person ? String(contact_person).trim() : pickLegacyContactPerson(contactsValidated.rows);

    const branch = await prisma.$transaction(async (tx) => {
      if (hq.unit_type === "standalone") {
        await tx.iml_customers.update({
          where: { id: headquartersId },
          data: { unit_type: "headquarters" },
        });
      }

      const created = await tx.iml_customers.create({
        data: {
          name: String(name).trim(),
          email: legacyEmail,
          phone: legacyPhone,
          contact_person: legacyContact,
          tax_country: taxCountry,
          ico: icoV.value,
          dic: dicV.value,
          city: city ? String(city).trim() : null,
          postal_code: postal_code ? String(postal_code).trim() : null,
          country: country ? String(country).trim() : "Česká republika",
          billing_address: billing_address ? String(billing_address).trim() : null,
          billing_company: billing_company ? String(billing_company).trim() : null,
          parent_id: headquartersId,
          unit_type: "branch",
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
      recordId: branch.id,
      newValues: { name: branch.name, parent_id: branch.parent_id, unit_type: "branch" },
    });

    return NextResponse.json({ success: true, id: branch.id });
  } catch (e) {
    console.error("IML branches POST error:", e);
    return NextResponse.json({ error: "Chyba při vytváření pobočky" }, { status: 500 });
  }
}
