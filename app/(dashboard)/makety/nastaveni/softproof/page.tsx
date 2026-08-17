import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllMaketyTypes } from "@/lib/makety-access";
import { SoftproofTemplatesForm } from "./SoftproofTemplatesForm";

export default async function MaketySoftproofTemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canViewAllMaketyTypes(userId))) {
    redirect("/makety");
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Šablony softproofu</h2>
      <p className="mb-4 text-sm text-gray-600">
        Texty e-mailu a veřejné stránky náhledu v jednotlivých jazycích (CZ, EN, DE, …)
      </p>
      <SoftproofTemplatesForm />
    </div>
  );
}
