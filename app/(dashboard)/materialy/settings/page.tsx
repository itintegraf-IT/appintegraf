import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { MaterialyCategorySettings } from "../_components/MaterialyCategorySettings";
import MaterialySettingsClient from "./MaterialySettingsClient";

export default async function MaterialySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "materialy", "write"))) redirect("/materialy");
  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nastavení katalogu materiálů</h1>
        <a href="/materialy" className="text-sm text-gray-500 hover:text-red-600">
          ← Katalog
        </a>
      </div>
      <MaterialyCategorySettings />
      <MaterialySettingsClient />
    </div>
  );
}
