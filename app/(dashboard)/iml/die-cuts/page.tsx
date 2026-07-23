import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { DieCutsClient } from "./DieCutsClient";

export default async function ImlDieCutsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const canRead = await hasModuleAccess(userId, "iml", "read");
  const canWrite = await hasModuleAccess(userId, "iml", "write");
  if (!canRead) redirect("/");

  return <DieCutsClient canWrite={canWrite} />;
}
