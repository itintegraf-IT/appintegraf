"use client";

import { useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

type Props = {
  user: { name?: string | null; email?: string | null; id?: string };
  isAdmin: boolean;
  moduleAccess: Record<string, boolean>;
};

export function DashboardShell({ user, isAdmin, moduleAccess }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <div className="print:hidden">
        <Header
          user={user}
          isAdmin={isAdmin}
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />
        <Sidebar
          user={user}
          isAdmin={isAdmin}
          moduleAccess={moduleAccess}
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </>
  );
}
