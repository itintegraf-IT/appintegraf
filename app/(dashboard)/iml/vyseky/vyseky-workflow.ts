/** Pořadí vyplňování katalogu výseků (podle závislostí dat). */

export type VysekyWorkflowStepId = "shapes" | "tools" | "impositions";

export type VysekyWorkflowStep = {
  id: VysekyWorkflowStepId;
  n: number;
  title: string;
  short: string;
  href: string;
  desc: string;
};

export const VYSEKY_WORKFLOW_STEPS: VysekyWorkflowStep[] = [
  {
    id: "shapes",
    n: 1,
    title: "Tvary",
    short: "Geometrie",
    href: "/iml/shapes",
    desc: "Založ kód a rozměry etikety (Š × V).",
  },
  {
    id: "tools",
    n: 2,
    title: "Nástroje",
    short: "Výsek (železo)",
    href: "/iml/tools",
    desc: "Železo / planžeta (u řezání lze nástroj u montáže vynechat).",
  },
  {
    id: "impositions",
    n: 3,
    title: "Montáže",
    short: "Arch + užitky",
    href: "/iml/impositions",
    desc: "Formát archu, zařízení, užitky a primární montáž.",
  },
];
