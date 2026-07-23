import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAdministerEquipment } from "@/lib/equipment/access";
import CategoriesSettingsClient from "./CategoriesSettingsClient";

export default async function CategoriesSettingsPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canAdministerEquipment(userId))) redirect("/equipment");
  return <CategoriesSettingsClient />;
}
