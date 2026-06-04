import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess, hasMaketyGrafikaAccess, hasMaketyVyrobaAccess } from "@/lib/auth-utils";
import { Printer } from "lucide-react";
import { MAKETY_MODULE_LABEL } from "@/lib/makety-module-label";
import { MaketyTabsNav } from "./MaketyTabsNav";

export const dynamic = "force-dynamic";

export default async function MaketyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  const canRead =
    (await hasModuleAccess(userId, "makety", "read")) ||
    (await hasMaketyVyrobaAccess(userId)) ||
    (await hasMaketyGrafikaAccess(userId));
  if (!canRead) {
    redirect("/");
  }

  const canWrite = await hasModuleAccess(userId, "makety", "write");
  const canVyroba = await hasMaketyVyrobaAccess(userId);
  const canGrafika = await hasMaketyGrafikaAccess(userId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Printer className="h-7 w-7 text-violet-600" />
          {MAKETY_MODULE_LABEL}
        </h1>
        <p className="mt-1 text-gray-600">Zadávání výroby na plotru a grafiku</p>
      </div>
      <MaketyTabsNav canWrite={canWrite} canVyroba={canVyroba} canGrafika={canGrafika} />
      {children}
    </div>
  );
}
