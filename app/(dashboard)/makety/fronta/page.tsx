import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageMaketyQueue } from "@/lib/makety-access";
import { type MaketyWorkType } from "@/lib/makety-work-type";
import { MaketyQueueDashboard } from "./MaketyQueueDashboard";

export const dynamic = "force-dynamic";

export default async function MaketyFrontaPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageMaketyQueue(userId))) {
    redirect("/makety");
  }

  const params = await searchParams;
  const initialTab: MaketyWorkType = params.tab === "grafika" ? "grafika" : "maketa";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Fronta výroby</h2>
        <p className="mt-1 text-sm text-gray-600">
          Řazení aktivních zakázek pro výrobce a grafiky. Zadavatelé vidí své zadání v Sledování zadání.
          Změna priority se propíše do kalendáře maket nebo grafiky (barva pruhu). Ruční pořadí se uloží
          do systému a kalendář používá stejné řazení; termín zakázky přetažením neměníte — v kalendáři
          zůstává podle data termínu a přiřazení.
        </p>
      </div>
      <MaketyQueueDashboard initialTab={initialTab} />
    </div>
  );
}
