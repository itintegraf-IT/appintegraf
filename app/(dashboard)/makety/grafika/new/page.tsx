import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canZadatMaketyWork } from "@/lib/makety-access";
import { getUsersWithMaketyGrafikaAccess } from "@/lib/makety-grafika-users";
import { NewMaketyWorkForm } from "../../NewMaketyWorkForm";

export const dynamic = "force-dynamic";

export default async function NewGrafikaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canZadatMaketyWork(userId, "grafika"))) {
    redirect("/makety");
  }

  const grafikaUsers = await getUsersWithMaketyGrafikaAccess();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Nová grafika</h2>
        <p className="mt-1 text-sm text-gray-600">Zadání práce pro oddělení grafiky.</p>
      </div>
      <NewMaketyWorkForm workType="grafika" assigneeUsers={grafikaUsers} />
    </div>
  );
}
