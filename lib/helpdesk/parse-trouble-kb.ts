export type TroubleEntry = {
  problem: string;
  solutionSteps: string[];
  tip?: string;
  causes?: string;
  symptoms?: string;
};

export type TroubleCategory = {
  name: string;
  entries: TroubleEntry[];
};

function parseSolutionSteps(block: string): string[] {
  const lines = block.split("\n");
  const steps: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^\d+\.\s*(.+)$/);
    if (match) {
      steps.push(match[1].trim());
    }
  }
  return steps;
}

function collapseWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseEntryBlock(block: string): TroubleEntry | null {
  const problemMatch = block.match(
    /PROBLÉM:\s*([\s\S]+?)(?=\n(?:MOŽNÉ PŘÍČINY:|MOŽNÁ PŘÍČINA:|PŘÍZNAKY:|ŘEŠENÍ:)|\s*$)/
  );
  if (!problemMatch) return null;

  const causesMatch = block.match(
    /(?:MOŽNÉ PŘÍČINY|MOŽNÁ PŘÍČINA):\s*([\s\S]*?)(?=\n(?:PŘÍZNAKY:|ŘEŠENÍ:)|\s*$)/
  );
  const symptomsMatch = block.match(/PŘÍZNAKY:\s*([\s\S]*?)(?=\nŘEŠENÍ:|\s*$)/);
  const solutionMatch = block.match(/ŘEŠENÍ:\s*([\s\S]*?)(?=\nTIP:|\s*$)/);
  const tipMatch = block.match(/TIP:\s*([\s\S]+?)$/);

  const solutionSteps = solutionMatch ? parseSolutionSteps(solutionMatch[1]) : [];
  if (solutionSteps.length === 0) return null;

  const causes = causesMatch ? collapseWs(causesMatch[1]) : undefined;
  const symptoms = symptomsMatch ? collapseWs(symptomsMatch[1]) : undefined;

  return {
    problem: collapseWs(problemMatch[1]),
    solutionSteps,
    tip: tipMatch ? collapseWs(tipMatch[1]) : undefined,
    causes: causes || undefined,
    symptoms: symptoms || undefined,
  };
}

/** Parsuje docs/trouble.txt do strukturované znalostní báze. */
export function parseTroubleKb(raw: string): TroubleCategory[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const body = normalized
    .replace(/^=+\s*[\s\S]*?Časté problémy[\s\S]*?=+\s*/m, "")
    .replace(/=+\s*Celkem problémů:[\s\S]*?=+\s*$/m, "")
    .trim();

  const categories: TroubleCategory[] = [];
  const categoryBlocks = body.split(/(?=KATEGORIE:\s)/i).filter((b) => b.trim());

  for (const catBlock of categoryBlocks) {
    const nameMatch = catBlock.match(/^KATEGORIE:\s*(.+?)(?:\n|-{2,})/i);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    const rest = catBlock.slice(nameMatch[0].length);
    const entryBlocks = rest.split(/(?=PROBLÉM:)/i).filter((b) => b.trim().startsWith("PROBLÉM:"));

    const entries: TroubleEntry[] = [];
    for (const entryBlock of entryBlocks) {
      const entry = parseEntryBlock(entryBlock);
      if (entry) entries.push(entry);
    }

    if (entries.length > 0) {
      categories.push({ name, entries });
    }
  }

  return categories;
}
