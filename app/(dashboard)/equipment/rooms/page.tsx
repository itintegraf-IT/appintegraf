import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canManageRegister, canReadEquipment } from "@/lib/equipment/access";
import RoomsClient from "./RoomsClient";

export default async function RoomsPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canReadEquipment(userId))) redirect("/");
  // Seznam vidí každý čtenář; zakládání a úpravy hlídá API, hromadný tisk štítků je pro správu evidence.
  return <RoomsClient canManageRegister={await canManageRegister(userId)} />;
}
