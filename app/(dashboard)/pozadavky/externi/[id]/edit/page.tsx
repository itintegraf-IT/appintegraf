import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import { ItVendorDetailClient } from "../ItVendorDetailClient";

type Props = { params: Promise<{ id: string }> };

export default async function ItVendorEditPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    redirect("/pozadavky");
  }

  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) redirect("/pozadavky?tab=externi");

  return <ItVendorDetailClient id={id} mode="edit" />;
}
