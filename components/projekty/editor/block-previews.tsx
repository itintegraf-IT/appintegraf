"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export type BlockPreview = {
  mock: ReactNode;
  caption: string;
};

/**
 * Vizuální preview mock-up pro každý blok ze slash menu.
 * Klíčem je `Block.name` z blocks.ts. Renderuje se v SlashMenuPopover napravo
 * od highlighted itemu (Notion-style "right rail preview").
 */
export const BLOCK_PREVIEWS: Record<string, BlockPreview> = {
  "Nadpis 1": {
    mock: <div className="text-3xl font-bold tracking-tight text-foreground">Velký nadpis</div>,
    caption: "Velký nadpis pro hlavní sekce",
  },
  "Nadpis 2": {
    mock: <div className="text-2xl font-bold tracking-tight text-foreground">Středně velký nadpis</div>,
    caption: "Středně velký nadpis pro podsekce",
  },
  "Nadpis 3": {
    mock: <div className="text-base font-semibold tracking-tight text-foreground">Menší nadpis</div>,
    caption: "Menší nadpis pro detaily",
  },

  Odrážky: {
    mock: (
      <ul className="ml-4 list-disc space-y-1 text-sm text-foreground">
        <li>První položka</li>
        <li>Druhá položka</li>
        <li>Třetí položka</li>
      </ul>
    ),
    caption: "Vytvoří seznam s odrážkami",
  },

  "Číslovaný seznam": {
    mock: (
      <ol className="ml-4 list-decimal space-y-1 text-sm text-foreground">
        <li>První krok</li>
        <li>Druhý krok</li>
        <li>Třetí krok</li>
      </ol>
    ),
    caption: "Vytvoří číslovaný seznam",
  },

  "Úkolový seznam": {
    mock: (
      <ul className="space-y-1.5 text-sm text-foreground">
        <li className="flex items-center gap-2">
          <span className="grid size-4 place-items-center rounded border border-muted-foreground/40 bg-background">
            <span className="text-[10px]">✓</span>
          </span>
          <span className="line-through opacity-50">Hotový úkol</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-4 place-items-center rounded border border-muted-foreground/40 bg-background" />
          <span>Otevřený úkol</span>
        </li>
      </ul>
    ),
    caption: "Seznam s checkboxy",
  },

  Citace: {
    mock: (
      <blockquote className="border-l-2 border-muted-foreground/40 pl-3 text-sm italic text-muted-foreground">
        „Zaznamenej myšlenku, kterou stojí za to si pamatovat."
      </blockquote>
    ),
    caption: "Vyznačí citovaný text",
  },

  "Code block": {
    mock: (
      <pre className="rounded bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
        <code>{"const greet = () => {\n  return 'Ahoj';\n}"}</code>
      </pre>
    ),
    caption: "Blok pro ukázku kódu",
  },

  "Oddělovač": {
    mock: (
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground">Sekce A</div>
        <hr className="border-border" />
        <div className="text-xs text-muted-foreground">Sekce B</div>
      </div>
    ),
    caption: "Vodorovná čára mezi sekcemi",
  },

  Toggle: {
    mock: (
      <div className="space-y-1 text-sm text-foreground">
        <div className="flex items-center gap-1 font-medium">
          <ChevronRight className="size-3.5" strokeWidth={2} />
          <span>Klikni pro rozbalení</span>
        </div>
        <div className="ml-4 text-xs text-muted-foreground">Skryté detaily se ukáží uvnitř</div>
      </div>
    ),
    caption: "Skryje obsah za rozbalovací nadpis",
  },

  Callout: {
    mock: (
      <div className="flex items-start gap-2 rounded border border-border bg-muted/50 p-3 text-sm text-foreground">
        <span aria-hidden>💡</span>
        <span>Zvýrazni důležitou poznámku.</span>
      </div>
    ),
    caption: "Barevný box s emoji a textem",
  },

  Obrázek: {
    mock: (
      <div className="grid place-items-center rounded border-2 border-dashed border-border bg-muted/50 py-6 text-sm text-muted-foreground/70">
        <span aria-hidden className="text-2xl">🖼️</span>
        <span className="pt-1">Nahraj nebo vlož obrázek</span>
      </div>
    ),
    caption: "Vlož obrázek (drag & drop nebo upload)",
  },
};
