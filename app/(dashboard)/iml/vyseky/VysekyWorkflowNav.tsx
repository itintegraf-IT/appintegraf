"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  VYSEKY_WORKFLOW_STEPS,
  type VysekyWorkflowStepId,
} from "./vyseky-workflow";

type Props = {
  /** Zvýrazněný krok na podstránce; na hubu nevyplňovat. */
  current?: VysekyWorkflowStepId;
  /** Plný stepper na hubu vs. kompaktní lišta na podstránkách. */
  variant?: "hub" | "bar";
};

export function VysekyWorkflowNav({ current, variant = "bar" }: Props) {
  if (variant === "hub") {
    return (
      <ol className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {VYSEKY_WORKFLOW_STEPS.map((step, i) => (
          <li key={step.id} className="flex min-w-0 flex-1 items-stretch gap-0">
            <Link
              href={step.href}
              className="group flex flex-1 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:shadow"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                  {step.n}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-violet-800">
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500">{step.short}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600">{step.desc}</p>
            </Link>
            {i < VYSEKY_WORKFLOW_STEPS.length - 1 && (
              <div
                className="hidden shrink-0 items-center px-1 text-gray-300 lg:flex"
                aria-hidden
              >
                <ChevronRight className="h-5 w-5" />
              </div>
            )}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <nav
      aria-label="Postup výseků"
      className="overflow-x-auto rounded-lg border border-violet-100 bg-violet-50/60 px-2 py-2"
    >
      <ol className="flex min-w-max items-center gap-1 text-xs sm:text-sm">
        {VYSEKY_WORKFLOW_STEPS.map((step, i) => {
          const active = current === step.id;
          return (
            <li key={step.id} className="flex items-center gap-1">
              <Link
                href={step.href}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition ${
                  active
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-violet-900 hover:bg-violet-100"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    active ? "bg-white text-violet-700" : "bg-violet-200 text-violet-800"
                  }`}
                >
                  {step.n}
                </span>
                <span className="whitespace-nowrap">{step.title}</span>
              </Link>
              {i < VYSEKY_WORKFLOW_STEPS.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
