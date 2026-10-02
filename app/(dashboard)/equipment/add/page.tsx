import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canManageRegister } from "@/lib/equipment/access";
import { AddEquipmentForm } from "./AddEquipmentForm";

/**
 * Zařazení nákupu do evidence — jen správa evidence (účtárna = Editor Majetku, správce).
 * `?pool=` = kód ze štítku fondu QR (ze skeneru), `?room=` = místnost.
 */
export default async function AddEquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string | string[]; room?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await canManageRegister(userId))) redirect("/equipment");

  const params = await searchParams;
  const pool = typeof params.pool === "string" ? params.pool.slice(0, 120) : "";
  const room = typeof params.room === "string" && /^\d+$/.test(params.room) ? params.room : "";
  return <AddEquipmentForm initialPoolCode={pool} initialRoomId={room} />;
}
