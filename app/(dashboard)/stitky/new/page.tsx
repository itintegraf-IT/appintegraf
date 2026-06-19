import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canWriteStitkyOrder } from "@/lib/stitky/access";
import { StitkyOrderForm } from "../_components/StitkyOrderForm";

export const dynamic = "force-dynamic";

export default async function StitkyNewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteStitkyOrder(userId))) redirect("/stitky");

  const templates = await prisma.stitky_templates.findMany({
    orderBy: { sort_order: "asc" },
    select: { key: true, layout_status: true },
  });

  return (
    <>
      <Link href="/stitky" className="mb-4 inline-block text-sm text-red-700 hover:underline">
        ← Zpět na přehled
      </Link>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Nová zakázka štítků</h2>
      <StitkyOrderForm templates={templates} canWrite />
    </>
  );
}
