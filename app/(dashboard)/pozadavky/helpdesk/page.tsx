import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageHelpdesk } from "@/lib/helpdesk/access";
import { BackLink } from "@/components/navigation/BackLink";
import { HelpdeskManageClient } from "../_components/HelpdeskManageClient";

export const dynamic = "force-dynamic";

export default async function HelpdeskManagePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canManageHelpdesk(userId))) {
    redirect("/pozadavky?tab=helpdesk");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BackLink fallbackHref="/pozadavky?tab=helpdesk" />
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Správa helpdesku</h1>
          <p className="mt-1 text-sm text-gray-600">
            Filtrujte a řešte tickety od uživatelů — stav, žadatel, řešitel, priorita, kategorie.
          </p>
        </div>
      </div>

      <Suspense fallback={<p className="text-sm text-gray-500">Načítám…</p>}>
        <HelpdeskManageClient />
      </Suspense>
    </div>
  );
}
