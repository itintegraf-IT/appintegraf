import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canAdministerEquipment } from "@/lib/equipment/access";
import DataPrepClient from "./DataPrepClient";

export default async function DataPrepPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canAdministerEquipment(userId))) redirect("/equipment");
  return <DataPrepClient />;
}
