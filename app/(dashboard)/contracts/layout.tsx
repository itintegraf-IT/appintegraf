import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";

export default async function ContractsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = parseInt(session.user.id, 10);
  const allowed = await hasModuleAccess(userId, "contracts", "read");
  if (!allowed) {
    redirect("/?error=Nemáte oprávnění");
  }

  return <>{children}</>;
}
