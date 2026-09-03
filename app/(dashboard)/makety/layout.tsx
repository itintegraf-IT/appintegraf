import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasMaketyGrafikaAccess, hasMaketySpravaVzorkuAccess, hasMaketyVyrobaAccess } from "@/lib/auth-utils";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { Printer } from "lucide-react";
import { MAKETY_MODULE_LABEL } from "@/lib/makety-module-label";
import {
  canManageMaketyQueue,
  canViewAllMaketyTypes,
  canZadatAnyMaketyWork,
  canZadatMaketyWork,
} from "@/lib/makety-access";
import { MaketyTabsNav } from "./MaketyTabsNav";

export const dynamic = "force-dynamic";

export default async function MaketyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    redirect("/");
  }

  const canWriteMaketa = await canZadatMaketyWork(userId, "maketa");
  const canWriteGrafika = await canZadatMaketyWork(userId, "grafika");
  const canWriteAny = await canZadatAnyMaketyWork(userId);
  const canModuleAdmin = await canViewAllMaketyTypes(userId);
  const canVyroba = await hasMaketyVyrobaAccess(userId);
  const canGrafika =
    (await hasMaketyGrafikaAccess(userId)) || (await hasMaketySpravaVzorkuAccess(userId));
  const canManageQueue = await canManageMaketyQueue(userId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Printer className="h-7 w-7 text-violet-600" />
          {MAKETY_MODULE_LABEL}
        </h1>
        <p className="mt-1 text-gray-600">Zadávání výroby na plotru a grafiku</p>
      </div>
      <MaketyTabsNav
        canWriteMaketa={canWriteMaketa}
        canWriteGrafika={canWriteGrafika}
        canWriteAny={canWriteAny}
        canModuleAdmin={canModuleAdmin}
        canVyroba={canVyroba}
        canGrafika={canGrafika}
        canManageQueue={canManageQueue}
      />
      {children}
    </div>
  );
}
