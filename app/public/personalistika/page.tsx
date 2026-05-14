"use client";

import { ClipboardPenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { PersonalistikaQuestionnaireForm } from "@/components/personalistika/PersonalistikaQuestionnaireForm";

export default function PublicPersonalistikaPage() {
  const router = useRouter();

  return (
    <>
      <PublicHeader />
      <PersonalistikaQuestionnaireForm
        mode="public"
        submitEndpoint="/api/public/personalistika"
        onSuccess={() => router.push("/public/personalistika/odeslano")}
      />
    </>
  );
}

function PublicHeader() {
  return (
    <div className="mb-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <ClipboardPenLine className="h-7 w-7 text-red-600" />
        Dotazník uchazeče
      </h1>
      <p className="mt-1 text-gray-600">Rozšířený dotazník uchazeče. Sekce lze rozbalit/sbalit.</p>
    </div>
  );
}
