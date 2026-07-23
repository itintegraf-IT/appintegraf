import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canAdministerEquipment, canReadEquipment } from "@/lib/equipment/access";
import RoomsClient from "./RoomsClient";

export default async function RoomsPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canReadEquipment(userId))) redirect("/");
  // list is readable; create requires admin (enforced in API/UI buttons via client - admin sees create)
  void canAdministerEquipment;
  return <RoomsClient />;
}
