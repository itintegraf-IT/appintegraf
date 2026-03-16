import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getLayoutAccess } from "@/lib/auth-utils";

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
  const { admin, contacts, equipment, calendar, kiosk, training, planovani } = await getLayoutAccess(userId);

  const moduleAccess = {
    contacts,
    equipment,
    calendar,
    kiosk,
    training,
    planovani,
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <DashboardShell
        user={session.user}
        isAdmin={admin}
        moduleAccess={moduleAccess}
      />
      <main className="lg:pl-56 pt-14 print:pt-0 print:pl-0">
        <div className="p-4 sm:p-6 lg:p-8 print:p-2">{children}</div>
      </main>
    </div>
  );
}
