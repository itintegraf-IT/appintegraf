import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { TestRunClient } from "./TestRunClient";

export default async function TestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

      <TestRunClient
        testId={test.id}
        testName={test.name}
        timeLimit={test.time_limit ?? 30}
        passPercentage={test.pass_percentage ?? 70}
        questionCount={test.test_questions.length}
      />
    </>
  );
}
