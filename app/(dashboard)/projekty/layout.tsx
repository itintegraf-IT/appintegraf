import type { ReactNode } from "react";
import { QuickCaptureProvider } from "@/components/projekty/todos/QuickCaptureProvider";

// Layout modulu Projekty: obaluje stránky ⌘K quick-capture providerem (rychlé přidání
// osobního úkolu). Scoped jen na /projekty/* → žádná kolize s globálními zkratkami a
// zápis do /api/projekty/personal-todos je přirozeně gated přístupem k modulu.
export default function ProjektyLayout({ children }: { children: ReactNode }) {
  return <QuickCaptureProvider>{children}</QuickCaptureProvider>;
}
