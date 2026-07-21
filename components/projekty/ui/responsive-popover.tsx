"use client";
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/projekty/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/projekty/ui/sheet";

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

type Props = {
  trigger: React.ReactNode;
  title: string; // čeština, použito jako sheet title (a11y)
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  align?: "start" | "center" | "end";
  contentClassName?: string;
};

export function ResponsivePopover({
  trigger,
  title,
  children,
  open,
  onOpenChange,
  align = "start",
  contentClassName,
}: Props) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetTitle>{title}</SheetTitle>
          <div className="mt-3">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className={contentClassName}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
