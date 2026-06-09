import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { getCrmAccess } from "@/lib/crm/permissions";
import { redirectWithError } from "@/lib/navigation-errors";
import { CrmTabsNav } from "./CrmTabsNav";
import { HiddenActivitiesProvider } from "@/components/crm/activities/hidden-activities-context";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const { canRead, canAdmin } = await getCrmAccess(userId);
  if (!canRead) {
    redirectWithError("/", "NO_PERMISSION");
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Briefcase className="h-7 w-7 text-red-600" />
          CRM
        </h1>
        <p className="mt-1 text-gray-600">Obchodní vztahy, pipeline a aktivity</p>
      </div>
      <CrmTabsNav canAdmin={canAdmin} />
      <HiddenActivitiesProvider>{children}</HiddenActivitiesProvider>
    </div>
  );
}
