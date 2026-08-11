import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanEditMaketa } from "@/lib/makety-access";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { getUsersWithMaketyGrafikaAccess } from "@/lib/makety-grafika-users";
import { getUsersWithMaketyVyrobaAccess } from "@/lib/makety-vyroba-users";
import {
  getUsersWithMaketySchvalovatelFinalAccess,
  getUsersWithMaketySchvalovatelPrepressAccess,
} from "@/lib/makety-schvalovatel-users";
import { EditMaketyWorkForm } from "../../EditMaketyWorkForm";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copied?: string }>;
};

export default async function MaketaEditPage({ params, searchParams }: PageProps) {
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

  const sp = await searchParams;
  const justCopied = sp.copied === "1";

  const maketa = await prisma.makety.findUnique({
    where: { id },
    include: {
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });
  if (!maketa) notFound();

  const workType = (maketa.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  const assigneeUsers =
    workType === "grafika"
      ? await getUsersWithMaketyGrafikaAccess()
      : await getUsersWithMaketyVyrobaAccess();

  const [prepressUsers, finalUsers] =
    workType === "grafika"
      ? await Promise.all([
          getUsersWithMaketySchvalovatelPrepressAccess(),
          getUsersWithMaketySchvalovatelFinalAccess(),
        ])
      : [[], []];

  return (
    <div className="space-y-4">
      <Link href={`/makety/${id}`} className="inline-block text-sm text-violet-600 hover:underline">
        ← Zpět na detail
      </Link>
      {justCopied && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Kopie zakázky byla vytvořena. Upravte klienta nebo drobnosti a uložte. Soubory ze
          zdroje se nezkopírovaly — přidejte je na detailu.
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Upravit {maketyWorkTypeLabel(workType).toLowerCase()} #{id}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Doplňte nebo upravte údaje zakázky. Po uložení můžete na detailu přidat přílohy nebo
          komentář.
        </p>
      </div>
      <EditMaketyWorkForm
        maketaId={id}
        workType={workType}
        assigneeUsers={assigneeUsers}
        creatorName={`${maketa.users_creator.first_name} ${maketa.users_creator.last_name}`}
        prepressUsers={prepressUsers}
        finalUsers={finalUsers}
        initial={{
          body: maketa.body,
          order_number: maketa.order_number,
          priority: maketa.priority,
          data_kind: maketa.data_kind,
          due_at: maketa.due_at,
          quantity: maketa.quantity,
          assignee_user_id: maketa.assignee_user_id,
          customer_id: maketa.customer_id,
          product_id: maketa.product_id,
          die_cut_id: maketa.die_cut_id,
          label_code: maketa.label_code,
          job_number: maketa.job_number,
          prepress_user_id: maketa.prepress_user_id,
          final_approver_user_id: maketa.final_approver_user_id,
        }}
      />
    </div>
  );
}
