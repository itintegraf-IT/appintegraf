 "use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PersonalistikaSubmittedPage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(8);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);

    const timeout = setTimeout(() => {
      router.push("/login");
    }, 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center justify-center p-6">
      <div className="w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
        <h1 className="text-2xl font-bold text-gray-900">Dotazník byl odeslán</h1>
        <p className="mt-2 text-gray-600">
          Děkujeme za vyplnění. Vaše odpověď byla přijata.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Automatické přesměrování na titulku za {secondsLeft} s.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/public/personalistika"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Vyplnit nový dotazník
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Na titulku
          </Link>
        </div>
      </div>
    </div>
  );
}
