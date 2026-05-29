import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { IML_CUSTOMER_UPLOAD_MODULE } from "@/lib/iml-customer-upload";
import CustomerFormWizard from "../../_components/CustomerFormWizard";

export default async function ImlCustomerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canWrite = await hasModuleAccess(userId, "iml", "write");
  const admin = await isAdmin(userId);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  if (!canRead) redirect("/iml");

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) redirect("/iml/customers");

  const attachmentRows = await prisma.file_uploads.findMany({
    where: { module: IML_CUSTOMER_UPLOAD_MODULE, record_id: id },
    orderBy: { created_at: "desc" },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  const initialAttachments = attachmentRows.map((f) => ({
    id: f.id,
    original_filename: f.original_filename,
    file_path: f.file_path,
    file_size: f.file_size,
    mime_type: f.mime_type,
    uploaded_by: f.uploaded_by,
    created_at: f.created_at.toISOString(),
    users: f.users,
  }));

  return (
    <CustomerFormWizard
      mode="edit"
      customerId={String(id)}
      canWrite={canWrite}
      currentUserId={userId}
      isAdmin={admin}
      initialAttachments={initialAttachments}
    />
  );
}
