import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { TechnologieForm } from "../TechnologieForm";

export default async function TechnologieNewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "technologie", "write"))) redirect("/technologie");

  return <TechnologieForm mode="create" />;
}
