"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="integraf-theme"
      disableTransitionOnChange
    >
      <SessionProvider>
        {children}
        <Toaster richColors closeButton position="top-right" />
      </SessionProvider>
    </ThemeProvider>
  );
}
