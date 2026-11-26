import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { ImpositionsClient } from "./ImpositionsClient";

type Props = { searchParams?: Promise<{ shape_id?: string }> };

export default async function ImImpositionsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) redirect("/iml");
  const sp = searchParams ? await searchParams : {};
  const initialShapeId = (sp.shape_id ?? "").trim();
  return <ImpositionsClient initialShapeId={initialShapeId} />;
}
