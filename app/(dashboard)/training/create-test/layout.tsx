import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/navigation-errors";
import { hasModuleAccess } from "@/lib/auth-utils";

export default async function CreateTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "write"))) {
    redirectWithError("/training", "NO_MODULE_ACCESS");
  }

  return <>{children}</>;
}
