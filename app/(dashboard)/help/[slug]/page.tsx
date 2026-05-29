import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { HelpDocViewer } from "@/components/help/HelpDocViewer";
import { loadHelpDocMarkdown } from "@/lib/help/load-doc";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function HelpDocPage({ params }: Props) {
  const { slug } = await params;
  const doc = await loadHelpDocMarkdown(slug);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-4xl px-1 pb-12">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-red-600">
          Dashboard
        </Link>
        <span>/</span>
        <span className="flex items-center gap-1 text-gray-700">
          <BookOpen className="h-4 w-4" />
          Nápověda
        </span>
        <span>/</span>
        <span className="font-medium text-gray-900">{doc.title}</span>
      </nav>

      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-red-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět do aplikace
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <HelpDocViewer content={doc.content} />
      </div>
    </div>
  );
}
