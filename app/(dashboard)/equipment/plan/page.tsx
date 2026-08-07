import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAdministerEquipment, canReadEquipment, canWriteEquipment } from "@/lib/equipment/access";
import FloorPlanClient from "./FloorPlanClient";

export default async function EquipmentFloorPlanPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canReadEquipment(userId))) redirect("/");

  const canAdmin = await canAdministerEquipment(userId);
  const canWrite = canAdmin || (await canWriteEquipment(userId));

  return <FloorPlanClient canAdmin={canAdmin} canWrite={canWrite} />;
}
