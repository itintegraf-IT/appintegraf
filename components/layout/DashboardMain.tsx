"use client";

import { useSidebar } from "./SidebarContext";

type Props = {
  children: React.ReactNode;
};

export function DashboardMain({ children }: Props) {
  const { state } = useSidebar();

  const plClass =
    state === "expanded" ? "lg:pl-56" : state === "rail" ? "lg:pl-16" : "lg:pl-0";

  return (
    <main
      className={`pt-14 print:pt-0 print:pl-0 transition-[padding] duration-200 ${plClass}`}
    >
      <div className="p-4 sm:p-6 lg:p-8 print:p-2">{children}</div>
    </main>
  );
}
