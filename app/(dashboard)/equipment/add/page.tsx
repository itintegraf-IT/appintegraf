import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canManageRegister, canWriteEquipment } from "@/lib/equipment/access";
import { AddEquipmentForm } from "./AddEquipmentForm";

/** Zařazení nového majetku. `?pool=` = kód ze štítku fondu QR (ze skeneru), `?room=` = místnost. */
export default async function AddEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string; room?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canWriteEquipment(userId))) redirect("/equipment");

  const params = await searchParams;
  return (
    <AddEquipmentForm
      canSetManualTag={await canManageRegister(userId)}
      initialPoolCode={(params.pool ?? "").slice(0, 120)}
      initialRoomId={/^\d+$/.test(params.room ?? "") ? (params.room as string) : ""}
    />
  );
}
