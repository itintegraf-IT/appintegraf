"use client";

import { useParams } from "next/navigation";
import CustomerFormWizard from "../../_components/CustomerFormWizard";

export default function ImlCustomerEditPage() {
  const params = useParams();
  const id = params.id as string;
  return <CustomerFormWizard mode="edit" customerId={id} />;
}
