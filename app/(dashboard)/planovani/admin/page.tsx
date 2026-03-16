import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getPlanovaniRole } from "@/lib/planovani-auth";
import AdminDashboard from "../_components/AdminDashboard";

export default async function PlanovaniAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const role = await getPlanovaniRole(userId);
  if (role !== "ADMIN") redirect("/planovani");

  const currentUser = {
    id: userId,
    username: session.user.name ?? session.user.email ?? "uživatel",
    role,
  };

  return <AdminDashboard currentUser={currentUser} />;
}
