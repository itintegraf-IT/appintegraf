import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardMain } from "@/components/layout/DashboardMain";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { getLayoutAccess } from "@/lib/auth-utils";

/** Dashboard vyžaduje DB a auth – vždy renderovat za běhu, ne při buildu */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = parseInt(session.user.id, 10);
  const { admin, contacts, equipment, calendar, kiosk, training, planovani, iml, vyroba } = await getLayoutAccess(userId);

  const moduleAccess = {
    contacts,
    equipment,
    calendar,
    kiosk,
    training,
    planovani,
    iml,
    vyroba,
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen" style={{ background: "var(--background)" }}>
        <DashboardShell
          user={session.user}
          isAdmin={admin}
          moduleAccess={moduleAccess}
        />
        <DashboardMain>{children}</DashboardMain>
      </div>
    </SidebarProvider>
  );
}
