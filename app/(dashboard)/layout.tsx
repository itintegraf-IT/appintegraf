import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
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
  const { admin, contacts, equipment, calendar, kiosk, training } = await getLayoutAccess(userId);

  const moduleAccess = {
    contacts,
    equipment,
    calendar,
    kiosk,
    training,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={session.user} isAdmin={admin} />
      <Sidebar user={session.user} isAdmin={admin} moduleAccess={moduleAccess} />
      <main className="lg:pl-56 pt-14">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
