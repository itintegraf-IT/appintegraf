import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canReadVykresy } from "@/lib/vykresy/access";
import { VykresyListClient } from "./VykresyListClient";

export default async function VykresyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadVykresy(userId))) redirect("/");

  const canWrite = await hasModuleAccess(userId, "vykresy", "write");

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Načítání…</div>}>
      <VykresyListClient canWrite={canWrite} />
    </Suspense>
  );
}
