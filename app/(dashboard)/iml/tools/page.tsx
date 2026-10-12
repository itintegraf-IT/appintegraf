import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { ToolsClient } from "./ToolsClient";

export default async function ImToolsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) redirect("/iml");
  return <ToolsClient />;
}
