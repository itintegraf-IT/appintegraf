import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canZadatMaketyWork } from "@/lib/makety-access";
import { getUsersWithMaketyVyrobaAccess } from "@/lib/makety-vyroba-users";
import { NewMaketaForm } from "./NewMaketaForm";

export const dynamic = "force-dynamic";

export default async function NewMaketaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canZadatMaketyWork(userId, "maketa"))) {
    redirect("/makety");
  }

  const vyrobaUsers = await getUsersWithMaketyVyrobaAccess();

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Nová maketa</h2>
      <p className="mb-6 text-sm text-gray-600">
        Zadání výroby na plotru. Zakázka se přiřadí uživateli s rolí Výroba maket.
      </p>
      <NewMaketaForm vyrobaUsers={vyrobaUsers} />
    </div>
  );
}
