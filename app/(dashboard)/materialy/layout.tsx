import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canReadMaterialCatalog } from "@/lib/materialy/access";

export default async function MaterialyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) redirect("/");
  return <>{children}</>;
}
