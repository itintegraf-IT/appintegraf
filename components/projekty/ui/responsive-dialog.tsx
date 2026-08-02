"use client";

import * as React from "react";
import { Drawer } from "vaul";
import { useMediaQuery } from "@/hooks/projekty/useMediaQuery";
import { cn } from "@/lib/projekty/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/projekty/ui/dialog";

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isDesktop = useMediaQuery("(min-width: 640px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl",
            className,
          )}
        >
          <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
            <DialogTitle className="text-2xl">{title}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl bg-background p-6 pb-[env(safe-area-inset-bottom)]"
          style={{ maxHeight: "var(--drawer-max-h, 90dvh)" }}
        >
          <DrawerKeyboardAdjust />
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" aria-hidden />
          <Drawer.Title className="text-2xl font-semibold">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">Formulář pro {title.toLowerCase()}</Drawer.Description>
          <div className="overflow-y-auto pt-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * iOS Safari nepouští klávesnici do viewport units (vh/dvh), takže
 * max-h-[90dvh] neumí "ustoupit" klávesnici a editor scrolluje za ní.
 * Pomocí visualViewport.height detekujeme klávesnici a snížíme drawer
 * maxHeight přes CSS variable --drawer-max-h na <Drawer.Content>.
 *
 * Bez window/visualViewport (SSR, starší prohlížeč): no-op, fallback je
 * 90dvh default z CSS variable.
 *
 * Per ADR 0029.
 */
function DrawerKeyboardAdjust() {
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    function update() {
      const drawerEl = document.querySelector<HTMLElement>("[data-vaul-drawer]");
      if (!drawerEl) return;
      drawerEl.style.setProperty("--drawer-max-h", `${vv.height * 0.9}px`);
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return null;
}
