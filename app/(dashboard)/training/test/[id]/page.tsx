import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getTestAccessForUser } from "@/lib/training/access";
import { TestRunClient } from "./TestRunClient";

export default async function TestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "read"))) redirect("/");

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const test = await prisma.tests.findUnique({
    where: { id },
    include: {
      test_questions: {
        include: { questions: { select: { id: true } } },
        orderBy: { sort_order: "asc" },
      },
    },
  });

  if (!test || !test.is_active) notFound();

  const access = await getTestAccessForUser(userId, id);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{test.name}</h1>
          <p className="mt-1 text-gray-600">Test ke školení</p>
        </div>
        <Link
          href="/training"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          Zpět
        </Link>
      </div>

      {access.allowed ? (
        <TestRunClient
          testId={test.id}
          timeLimit={test.time_limit ?? 30}
          passPercentage={test.pass_percentage ?? 70}
        />
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-medium text-amber-800">
            {access.reason ?? "Test není dostupný"}
          </p>
          <Link href="/training" className="mt-4 inline-block text-red-600 hover:underline">
            Zpět na školení
          </Link>
        </div>
      )}
    </>
  );
}
