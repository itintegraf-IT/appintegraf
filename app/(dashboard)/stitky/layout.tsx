import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canReadStitky } from "@/lib/stitky/access";
import { getStitkyLayoutNavFlags } from "@/lib/stitky/list-access";
import { Tags } from "lucide-react";
import { StitkyTabsNav } from "./StitkyTabsNav";
import "./stitky-print.css";

export const dynamic = "force-dynamic";

export default async function StitkyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadStitky(userId))) redirect("/");

  const nav = await getStitkyLayoutNavFlags(userId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Tags className="h-7 w-7 text-red-600" />
          Štítky výroba
        </h1>
        <p className="mt-1 text-gray-600">Zadávání a tisk výrobních štítků</p>
      </div>
      <StitkyTabsNav
        canWrite={nav.canWrite}
        canQueue={nav.canQueue}
        canAll={nav.canAll}
        canAdmin={nav.canAdmin}
      />
      {children}
    </div>
  );
}
