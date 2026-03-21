import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPlanovaniAccess } from "@/lib/planovani-auth";
import JobBuilderPopout from "../_components/JobBuilderPopout";

export default async function PlanovaniBuilderPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasPlanovaniAccess(userId))) redirect("/");

  return <JobBuilderPopout />;
}
