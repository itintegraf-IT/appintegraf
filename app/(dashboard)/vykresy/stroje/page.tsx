import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canWriteVykresy } from "@/lib/vykresy/access";
import { VykresyMachinesClient } from "./VykresyMachinesClient";

export default async function VykresyMachinesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) redirect("/vykresy");

  return <VykresyMachinesClient />;
}
