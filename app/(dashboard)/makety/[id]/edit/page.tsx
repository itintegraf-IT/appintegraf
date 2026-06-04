import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanEditMaketa } from "@/lib/makety-access";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { getUsersWithMaketyGrafikaAccess } from "@/lib/makety-grafika-users";
import { getUsersWithMaketyVyrobaAccess } from "@/lib/makety-vyroba-users";
import { EditMaketyWorkForm } from "../../EditMaketyWorkForm";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MaketaEditPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    redirect("/");
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  if (!(await userCanEditMaketa(userId, id))) {
    redirect(`/makety/${id}`);
  }

  const maketa = await prisma.makety.findUnique({ where: { id } });
  if (!maketa) notFound();

  const workType = (maketa.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  const assigneeUsers =
    workType === "grafika"
      ? await getUsersWithMaketyGrafikaAccess()
      : await getUsersWithMaketyVyrobaAccess();

  return (
    <div className="space-y-4">
      <Link href={`/makety/${id}`} className="inline-block text-sm text-violet-600 hover:underline">
        ← Zpět na detail
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Upravit {maketyWorkTypeLabel(workType).toLowerCase()} #{id}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Doplňte nebo upravte údaje zakázky. Po uložení můžete na detailu přidat přílohy nebo komentář.
        </p>
      </div>
      <EditMaketyWorkForm
        maketaId={id}
        workType={workType}
        assigneeUsers={assigneeUsers}
        initial={{
          body: maketa.body,
          order_number: maketa.order_number,
          priority: maketa.priority,
          due_at: maketa.due_at,
          quantity: maketa.quantity,
          assignee_user_id: maketa.assignee_user_id,
        }}
      />
    </div>
  );
}
