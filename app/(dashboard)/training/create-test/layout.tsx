import { auth } from "@/auth";
import { redirect } from "next/navigation";
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
    redirect("/training?error=no-access");
  }

  return <>{children}</>;
}
