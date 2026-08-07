import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { getVisibleTestsForUser } from "@/lib/training/access";
import { BookOpen, Settings, History } from "lucide-react";
import { TrainingSuccessBanner } from "./TrainingSuccessBanner";
import { TrainingOverviewClient } from "./TrainingOverviewClient";

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "training", "read"))) redirect("/");

  const canWrite = await hasModuleAccess(userId, "training", "write");

  const [tests, materials, categories] = await Promise.all([
    getVisibleTestsForUser(userId),
    prisma.learning_materials.findMany({
      include: { question_categories: { select: { id: true, name: true, color: true } } },
      orderBy: { title: "asc" },
    }),
    prisma.question_categories.findMany({
      where: { learning_materials: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  const assignedTests = tests.filter((t) => t.assignment !== null);
  const openTests = tests.filter((t) => t.assignment === null);

  return (
    <>
      <TrainingSuccessBanner />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BookOpen className="h-7 w-7 text-red-600" />
            IT Školení
          </h1>
          <p className="mt-1 text-gray-600">Testy a materiály ke školení</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/training/results"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
          >
            <History className="h-4 w-4" />
            Moje výsledky
          </Link>
          {canWrite && (
            <Link
              href="/training/manage"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
            >
              <Settings className="h-4 w-4" />
              Administrace
            </Link>
          )}
        </div>
      </div>

      <Suspense fallback={<div className="text-gray-500">Načítání…</div>}>
        <TrainingOverviewClient
          materials={materials}
          categories={categories}
          assignedTests={assignedTests}
          openTests={openTests}
        />
      </Suspense>
    </>
  );
}
