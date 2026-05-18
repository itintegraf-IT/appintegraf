import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/navigation-errors";
import { hasModuleAccess } from "@/lib/auth-utils";
import { PersonalistikaClient } from "./PersonalistikaClient";

export default async function PersonalistikaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);

  const canRead = await hasModuleAccess(userId, "personalistika", "read");
  if (!canRead) redirectWithError("/", "NO_PERSONALISTIKA");

  const canWrite = await hasModuleAccess(userId, "personalistika", "write");
  return <PersonalistikaClient canWrite={canWrite} />;
}
