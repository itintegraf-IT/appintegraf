import type { ReactNode } from "react";

type EntityDetailLayoutProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
};

export function EntityDetailLayout({
  title,
  subtitle,
  actions,
  sidebar,
  children,
}: EntityDetailLayoutProps) {
  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <div className="text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {sidebar ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-10">{children}</div>
          <aside className="space-y-6">{sidebar}</aside>
        </div>
      ) : (
        <div className="space-y-10">{children}</div>
      )}
    </div>
  );
}
