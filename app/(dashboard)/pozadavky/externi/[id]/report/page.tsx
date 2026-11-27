import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { canManageItVendorRequests } from "@/lib/it-vendor-request/access";
import {
  buildItVendorReportHtml,
  loadItVendorReport,
} from "@/lib/it-vendor-request/report";
import { ItVendorReportClient } from "./ItVendorReportClient";

type Props = { params: Promise<{ id: string }> };

export default async function ItVendorReportPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canManageItVendorRequests(userId))) {
    redirect("/pozadavky");
  }

  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) redirect("/pozadavky?tab=externi");

  const data = await loadItVendorReport(id);
  if (!data) notFound();

  const reportHtml = buildItVendorReportHtml(data);

  return <ItVendorReportClient id={id} data={data} reportHtml={reportHtml} />;
}
