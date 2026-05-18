import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canWriteMaterialCatalog } from "@/lib/materialy/access";

export default async function MaterialyAddLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteMaterialCatalog(userId))) redirect("/materialy");
  return <>{children}</>;
}
