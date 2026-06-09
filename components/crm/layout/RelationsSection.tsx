import type { ReactNode } from "react";

type RelationsSectionProps = {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
};

export function RelationsSection({ title, count, action, children }: RelationsSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          {title}
          {typeof count === "number" ? (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">({count})</span>
          ) : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
