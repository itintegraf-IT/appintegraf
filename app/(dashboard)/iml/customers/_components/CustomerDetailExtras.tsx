"use client";

import CustomerBranchesPanel, {
  type BranchListItem,
} from "./CustomerBranchesPanel";

type BranchFromServer = {
  id: number;
  name: string;
  unit_type: string;
  city: string | null;
  postal_code?: string | null;
  email: string | null;
  phone: string | null;
  contact_person?: string | null;
  billing_address?: string | null;
  _count?: { iml_customer_shipping_addresses: number };
  iml_customer_emails?: Array<{ email: string }>;
};

function mapBranches(branches: BranchFromServer[]): BranchListItem[] {
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    unit_type: b.unit_type,
    city: b.city,
    postal_code: b.postal_code,
    email: b.email,
    primary_email: b.iml_customer_emails?.[0]?.email ?? b.email,
    phone: b.phone,
    contact_person: b.contact_person,
    billing_address: b.billing_address,
    shipping_addresses_count: b._count?.iml_customer_shipping_addresses ?? 0,
  }));
}

export function CustomerBranchesSection({
  headquartersId,
  unitType,
  branches,
  canWrite,
}: {
  headquartersId: number;
  unitType: string;
  branches: BranchFromServer[];
  canWrite: boolean;
}) {
  return (
    <CustomerBranchesPanel
      headquartersId={headquartersId}
      unitType={unitType}
      branches={mapBranches(branches)}
      canWrite={canWrite}
    />
  );
}
