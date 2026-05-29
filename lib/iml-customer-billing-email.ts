import type { CustomerEmailRow } from "@/app/(dashboard)/iml/customers/_components/CustomerEmailsEditor";

type EmailLike = { email: string; kind: string; is_primary?: boolean };

/** První billing e-mail (primární, jinak první billing). */
export function extractBillingEmail(rows: EmailLike[]): string {
  const primary = rows.find((r) => r.kind === "billing" && r.is_primary);
  if (primary) return primary.email;
  const any = rows.find((r) => r.kind === "billing");
  return any?.email ?? "";
}

/** Oddělí fakturační e-mail od řádků pro editor (general/orders). */
export function splitEmailsForEditor(rows: CustomerEmailRow[]): {
  billingEmail: string;
  otherRows: CustomerEmailRow[];
} {
  const billingEmail = extractBillingEmail(rows);
  const otherRows = rows.filter((r) => r.kind !== "billing");
  return { billingEmail, otherRows };
}

/** Sloučí pole fakturačního e-mailu zpět do pole pro API. */
export function mergeBillingEmailIntoRows(
  billingEmail: string,
  otherRows: CustomerEmailRow[]
): CustomerEmailRow[] {
  const trimmed = billingEmail.trim();
  const withoutBilling = otherRows.filter((r) => r.kind !== "billing");
  if (!trimmed) return withoutBilling;
  const maxOrder = withoutBilling.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1);
  return [
    ...withoutBilling,
    {
      email: trimmed,
      kind: "billing",
      is_primary: true,
      sort_order: maxOrder + 1,
    },
  ];
}
