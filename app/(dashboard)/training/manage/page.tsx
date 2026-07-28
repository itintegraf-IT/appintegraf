import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  HelpCircle,
  Upload,
  FileText,
  ClipboardList,
  Users,
  CalendarClock,
  BarChart3,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";

export default async function TrainingManagePage() {
  const [
    questionsCount,
    activeQuestionsCount,
    categoriesCount,
    materialsCount,
    testsCount,
    activeTestsCount,
    groupsCount,
    assignmentsCount,
    attemptsCount,
    importsCount,
  ] = await Promise.all([
    prisma.questions.count(),
    prisma.questions.count({ where: { is_active: true } }),
    prisma.question_categories.count(),
    prisma.learning_materials.count(),
    prisma.tests.count(),
    prisma.tests.count({ where: { is_active: true } }),
    prisma.user_groups.count(),
    prisma.test_assignments.count({ where: { is_active: true } }),
    prisma.test_attempts.count({ where: { completed_at: { not: null } } }),
    prisma.question_imports.count(),
  ]);

  const cards = [
    {
      href: "/training/manage/questions",
      icon: HelpCircle,
      label: "Otázky",
      value: `${activeQuestionsCount} aktivních / ${questionsCount} celkem`,
      description: `${categoriesCount} kategorií`,
    },
    {
      href: "/training/manage/import",
      icon: Upload,
      label: "Import CSV",
      value: `${importsCount} importů`,
      description: "Hromadné nahrání otázek ze souboru",
    },
    {
      href: "/training/manage/materials",
      icon: FileText,
      label: "Materiály",
      value: `${materialsCount} materiálů`,
      description: "Učební texty ke školení",
    },
    {
      href: "/training/manage/tests",
      icon: ClipboardList,
      label: "Testy",
      value: `${activeTestsCount} aktivních / ${testsCount} celkem`,
      description: "Definice testů a výběr otázek",
    },
    {
      href: "/training/manage/groups",
      icon: Users,
      label: "Skupiny",
      value: `${groupsCount} skupin`,
      description: "Skupiny uživatelů pro přiřazení testů",
    },
    {
      href: "/training/manage/assignments",
      icon: CalendarClock,
      label: "Přiřazení",
      value: `${assignmentsCount} aktivních`,
      description: "Termíny a limity pokusů",
    },
    {
      href: "/training/manage/results",
      icon: BarChart3,
      label: "Výsledky",
      value: `${attemptsCount} dokončených pokusů`,
      description: "Reporty a export do CSV",
    },
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <GraduationCap className="h-7 w-7 text-red-600" />
            Administrace IT Školení
          </h1>
          <p className="mt-1 text-gray-600">
            Správa otázek, testů, materiálů, skupin a vyhodnocení
          </p>
        </div>
        <Link
          href="/training"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na školení
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-50 p-2.5">
                  <Icon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{card.label}</p>
                  <p className="text-sm text-gray-600">{card.value}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-500">{card.description}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
