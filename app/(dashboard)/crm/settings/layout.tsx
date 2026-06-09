import { redirect } from "next/navigation";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { CrmAdminNav } from "@/components/crm/admin/CrmAdminNav";

export const dynamic = "force-dynamic";

export default async function CrmSettingsLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireCrmAdmin();
  } catch {
    redirect("/crm");
  }

  return (
    <div>
      <CrmAdminNav />
      {children}
    </div>
  );
}
