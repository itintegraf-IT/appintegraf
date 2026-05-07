import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { InquiryDetailClient, type InquiryDetailPayload } from "./InquiryDetailClient";

export default async function ImlInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  if (!canRead) redirect("/");

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const inquiry = await prisma.iml_inquiries.findUnique({
    where: { id },
    include: {
      iml_customers: { select: { id: true, name: true } },
      iml_inquiry_items: {
        include: {
          iml_products: {
            select: { ig_code: true, client_name: true, ig_short_name: true },
          },
        },
      },
      iml_orders: { select: { id: true, order_number: true } },
    },
  });

  if (!inquiry) notFound();

  const initial = JSON.parse(JSON.stringify(inquiry)) as InquiryDetailPayload;
  const canWrite = await hasModuleAccess(userId, "iml", "write");

  return <InquiryDetailClient initial={initial} canWrite={canWrite} />;
}
