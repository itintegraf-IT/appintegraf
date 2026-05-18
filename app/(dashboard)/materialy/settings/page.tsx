import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import MaterialySettingsClient from "./MaterialySettingsClient";

export default async function MaterialySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "materialy", "write"))) redirect("/materialy");
  return <MaterialySettingsClient />;
}
