import type { ReactNode } from "react";
import { QuickCaptureProvider } from "@/components/projekty/todos/QuickCaptureProvider";
import { Toaster } from "@/components/projekty/ui/sonner";

// Layout modulu Projekty: quick-capture provider (rychlé přidání osobního úkolu)
// + Toaster pro sonner toasty (modulově scoped — globální layout Toaster nemá).
// Scoped jen na /projekty/* → žádná kolize s globálními zkratkami a zápis do
// /api/projekty/personal-todos je přirozeně gated přístupem k modulu.
export default function ProjektyLayout({ children }: { children: ReactNode }) {
  return (
    <QuickCaptureProvider>
      {children}
      <Toaster position="bottom-right" richColors />
    </QuickCaptureProvider>
  );
}
