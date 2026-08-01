import { Suspense, type ReactNode } from "react";
import { QuickCaptureProvider } from "@/components/projekty/todos/QuickCaptureProvider";
import { CommandPalette } from "@/components/projekty/CommandPalette";
import { Toaster } from "@/components/projekty/ui/sonner";

// Layout modulu Projekty: quick-capture provider (Ctrl/⌘+Shift+K), command
// palette (Ctrl/⌘+K) a Toaster pro sonner toasty (modulově scoped — globální
// layout Toaster nemá). Scoped jen na /projekty/* → žádná kolize s globálními
// zkratkami; zápisy jsou přirozeně gated přístupem k modulu.
export default function ProjektyLayout({ children }: { children: ReactNode }) {
  return (
    <QuickCaptureProvider>
      {children}
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <Toaster position="bottom-right" richColors />
    </QuickCaptureProvider>
  );
}
