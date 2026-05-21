import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import CustomerFormWizard from "../_components/CustomerFormWizard";

export default async function ImlCustomerAddPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canWrite = await hasModuleAccess(userId, "iml", "write");
  const admin = await isAdmin(userId);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  if (!canRead) redirect("/iml");

  return (
    <CustomerFormWizard
      mode="create"
      canWrite={canWrite}
      currentUserId={userId}
      isAdmin={admin}
    />
  );
}
