import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAdministerEquipment, canManageRegister, canReadEquipment } from "@/lib/equipment/access";
import { InventuraClient } from "./InventuraClient";

/** Inventura. Rozsahy podle role: místnost jen správa evidence, celá firma jen správce. */
export default async function InventuraPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canReadEquipment(userId))) redirect("/equipment");

  return (
    <InventuraClient
      canManageRegister={await canManageRegister(userId)}
      canAdminister={await canAdministerEquipment(userId)}
    />
  );
}
