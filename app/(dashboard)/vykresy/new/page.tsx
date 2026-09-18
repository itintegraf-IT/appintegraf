import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canWriteVykresy } from "@/lib/vykresy/access";
import { VykresyForm } from "../VykresyForm";

export default async function VykresyNewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) redirect("/vykresy");

  return <VykresyForm mode="create" />;
}
