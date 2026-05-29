import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { logImlAudit } from "@/lib/iml-audit";
import { resolveCatalogCustomerId } from "@/lib/iml-customer-catalog";
import { assertValidUnitAssignment } from "@/lib/iml-customer-unit-rules";
import { normalizeTaxCountry } from "@/lib/iml-customer-units";
import {
  parseIncomingContacts,
  parseIncomingEmails,
  pickLegacyContactPerson,
  pickLegacyEmailFromNested,
  pickLegacyPhoneFromContacts,
  syncCustomerContacts,
  syncCustomerEmails,
  type NormalizedCustomerContact,
  validateNestedContacts,
  validateNestedEmails,
} from "@/lib/iml-customer-nested";
import {
  parseDraftShippingList,
  replaceCustomerShippingAddresses,
  syncHeadquartersBranches,
  type IncomingBranchPayload,
} from "@/lib/iml-customer-persist";
import {
  validateEmail,
  validateInternationalPhone,
  validateTaxIds,
} from "@/lib/iml-validation";
import { deleteAllCustomerUploads } from "@/lib/iml-customer-upload";

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

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const catalogCustomerId = await resolveCatalogCustomerId(id);

  const customer = await prisma.iml_customers.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true, unit_type: true } },
      iml_customer_shipping_addresses: {
        orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
      },
      branches: {
        orderBy: [{ sort_order: "asc" }, { name: "asc" }],
        include: {
          iml_customer_emails: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] },
          iml_customer_contacts: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] },
          iml_customer_shipping_addresses: {
            orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
          },
        },
      },
      iml_customer_emails: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] },
      iml_customer_contacts: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] },
      iml_products: {
        where: { customer_id: catalogCustomerId },
        select: { id: true, ig_code: true, ig_short_name: true, client_name: true },
      },
      iml_orders: {
        select: { id: true, order_number: true, order_date: true, status: true, total: true },
        orderBy: { order_date: "desc" },
        take: 50,
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  return NextResponse.json({
    ...customer,
    catalog_customer_id: catalogCustomerId,
  });
}

export async function PUT(
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

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_customers.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
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
      parent_id = existing.parent_id,
      unit_type = existing.unit_type,
      sort_order = existing.sort_order,
      emails: emailsRaw,
      contacts: contactsRaw,
      sync_emails = false,
      sync_contacts = false,
      is_headquarters,
      shipping_addresses: shippingAddressesRaw,
      branches: branchesRaw,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Vyplňte název zákazníka", field: "name" }, { status: 400 });
    }

    const taxCountry = normalizeTaxCountry(tax_country) ?? existing.tax_country;
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

    if (is_headquarters === true && existing.parent_id != null) {
      return NextResponse.json(
        { error: "Pobočku nelze označit jako centrálu" },
        { status: 400 }
      );
    }

    const parentIdParsed =
      parent_id != null && parent_id !== ""
        ? parseInt(String(parent_id), 10)
        : null;
    const resolvedUnitType =
      is_headquarters === true
        ? "headquarters"
        : is_headquarters === false && existing.parent_id == null
          ? "standalone"
          : unit_type ?? existing.unit_type;

    const unitCheck = await assertValidUnitAssignment({
      unitType: resolvedUnitType,
      parentId: Number.isNaN(parentIdParsed) ? null : parentIdParsed,
      customerId: id,
    });
    if (!unitCheck.ok) {
      return NextResponse.json({ error: unitCheck.error, field: "parent_id" }, { status: 400 });
    }

    const wantsHeadquarters = is_headquarters === true || unitCheck.unitType === "headquarters";
    const incomingBranches: IncomingBranchPayload[] | null =
      branchesRaw != null && Array.isArray(branchesRaw)
        ? (branchesRaw as IncomingBranchPayload[])
        : null;
    const shippingDraft =
      shippingAddressesRaw != null ? parseDraftShippingList(shippingAddressesRaw) : null;

    let emailRows = parseIncomingEmails(emailsRaw);
    if (sync_emails || emailsRaw != null) {
      const emailsValidated = await validateNestedEmails(parseIncomingEmails(emailsRaw));
      if (!emailsValidated.ok) {
        return NextResponse.json(
          { error: emailsValidated.error, field: emailsValidated.field },
          { status: 400 }
        );
      }
      emailRows = emailsValidated.rows;
    }

    let contactRows: NormalizedCustomerContact[] = [];
    if (sync_contacts || contactsRaw != null) {
      const contactsValidated = await validateNestedContacts(parseIncomingContacts(contactsRaw));
      if (!contactsValidated.ok) {
        return NextResponse.json(
          { error: contactsValidated.error, field: contactsValidated.field },
          { status: 400 }
        );
      }
      contactRows = contactsValidated.rows;
    }

    const legacyEmail =
      emailV.value ??
      (emailRows.length > 0 ? pickLegacyEmailFromNested(emailRows) : existing.email);
    const legacyPhone =
      phoneV.value ??
      (contactRows.length > 0 ? pickLegacyPhoneFromContacts(contactRows) : existing.phone);
    const legacyContact =
      contact_person != null && String(contact_person).trim() !== ""
        ? String(contact_person).trim()
        : contactRows.length > 0
          ? pickLegacyContactPerson(contactRows)
          : existing.contact_person;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.iml_customers.update({
        where: { id },
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

      if (sync_emails || emailsRaw != null) {
        await syncCustomerEmails(tx, id, emailRows);
      }
      if (sync_contacts || contactsRaw != null) {
        await syncCustomerContacts(tx, id, contactRows);
      }

      if (shippingDraft != null) {
        await replaceCustomerShippingAddresses(tx, id, shippingDraft);
      }

      if (
        is_headquarters === true &&
        existing.parent_id == null &&
        existing.unit_type === "standalone"
      ) {
        await tx.iml_customers.update({
          where: { id },
          data: { unit_type: "headquarters" },
        });
      }

      if (incomingBranches != null) {
        if (!wantsHeadquarters && incomingBranches.length > 0) {
          throw new Error("BRANCHES_WITHOUT_HQ");
        }
        if (wantsHeadquarters) {
          if (unitCheck.unitType === "standalone") {
            await tx.iml_customers.update({
              where: { id },
              data: { unit_type: "headquarters" },
            });
          }
          const branchSync = await syncHeadquartersBranches(tx, id, incomingBranches);
          if ("error" in branchSync) {
            throw new Error(`BRANCH_SYNC:${branchSync.error}`);
          }
        } else if (existing.unit_type === "headquarters") {
          const branchSync = await syncHeadquartersBranches(tx, id, []);
          if ("error" in branchSync) {
            throw new Error(`BRANCH_SYNC:${branchSync.error}`);
          }
          await tx.iml_customers.update({
            where: { id },
            data: { unit_type: "standalone" },
          });
        }
      }

      return row;
    });

    await logImlAudit({
      userId,
      action: "update",
      tableName: "iml_customers",
      recordId: id,
      oldValues: { name: existing.name, email: existing.email, ico: existing.ico },
      newValues: { name: updated.name, email: updated.email, ico: updated.ico },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("BRANCH_SYNC:")) {
      return NextResponse.json(
        { error: msg.replace("BRANCH_SYNC:", "") },
        { status: 400 }
      );
    }
    if (msg === "BRANCHES_WITHOUT_HQ") {
      return NextResponse.json(
        { error: "Pobočky lze uložit jen u centrály skupiny" },
        { status: 400 }
      );
    }
    console.error("IML customers PUT error:", e);
    return NextResponse.json({ error: "Chyba při ukládání zákazníka" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
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

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.iml_customers.findUnique({
    where: { id },
    include: {
      iml_orders: { take: 1 },
      branches: { take: 1, select: { id: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Zákazník nenalezen" }, { status: 404 });
  }

  if (existing.iml_orders.length > 0) {
    return NextResponse.json(
      { error: "Zákazníka nelze smazat – má přiřazené objednávky" },
      { status: 400 }
    );
  }

  if (existing.branches.length > 0) {
    return NextResponse.json(
      { error: "Nejprve smažte nebo přesuňte pobočky této centrály" },
      { status: 400 }
    );
  }

  await deleteAllCustomerUploads(id);
  await prisma.iml_customers.delete({ where: { id } });

  await logImlAudit({
    userId,
    action: "delete",
    tableName: "iml_customers",
    recordId: id,
    oldValues: { name: existing.name, email: existing.email },
  });

  return NextResponse.json({ success: true });
}
