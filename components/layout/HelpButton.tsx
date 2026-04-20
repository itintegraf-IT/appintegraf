"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { HelpDrawer } from "./HelpDrawer";
import { resolveHelpEntry } from "@/lib/help/resolve-help";

type Props = {
  moduleAccess: Record<string, boolean>;
  isAdmin: boolean;
};

export function HelpButton({ moduleAccess, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const entry = useMemo(
    () => resolveHelpEntry(pathname ?? "/"),
    [pathname]
  );

  const tooltip =
    entry.key === "dashboard"
      ? "Nápověda k aplikaci"
      : `Nápověda – ${entry.title}`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isEditable) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "F1") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 transition-colors hover:bg-[var(--accent)]"
        style={{ color: "var(--foreground)" }}
        aria-label={tooltip}
        title={`${tooltip} (?)`}
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      <HelpDrawer
        open={open}
        onClose={() => setOpen(false)}
        moduleAccess={moduleAccess}
        isAdmin={isAdmin}
      />
    </>
  );
}
