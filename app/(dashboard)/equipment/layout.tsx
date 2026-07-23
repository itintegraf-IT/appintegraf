import { auth } from "@/auth";
import { canAdministerEquipment } from "@/lib/equipment/access";
import { EquipmentModuleNav } from "./_components/EquipmentModuleNav";

export default async function EquipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const canAdmin = userId > 0 ? await canAdministerEquipment(userId) : false;

  return (
    <>
      <EquipmentModuleNav canAdmin={canAdmin} />
      {children}
    </>
  );
}
