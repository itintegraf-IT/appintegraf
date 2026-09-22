import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAdministerEquipment } from "@/lib/equipment/access";
import LabelsSettingsClient from "./LabelsSettingsClient";

export default async function EquipmentLabelsSettingsPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canAdministerEquipment(userId))) redirect("/equipment");
  return <LabelsSettingsClient />;
}
