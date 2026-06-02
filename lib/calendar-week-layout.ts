/** Položka pro výpočet sloupců v denní mřížce (vlastník nebo syntetický zástup). */
export type WeekDayLayoutItem = {
  id: string;
  eventId: number;
  pairId: string;
  kind: "owner" | "deputy";
  startMs: number;
  endMs: number;
};

export type WeekDayLayoutPosition = {
  column: number;
  columnCount: number;
};

function itemsOverlap(a: WeekDayLayoutItem, b: WeekDayLayoutItem): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function buildOverlapGroups(items: WeekDayLayoutItem[]): WeekDayLayoutItem[][] {
  const remaining = [...items];
  const groups: WeekDayLayoutItem[][] = [];

  while (remaining.length > 0) {
    const group: WeekDayLayoutItem[] = [remaining.pop()!];
    let i = 0;
    while (i < group.length) {
      const cur = group[i];
      for (let j = remaining.length - 1; j >= 0; j--) {
        if (itemsOverlap(cur, remaining[j])) {
          group.push(remaining[j]);
          remaining.splice(j, 1);
        }
      }
      i++;
    }
    groups.push(group);
  }
  return groups;
}

function layoutOverlapGroup(group: WeekDayLayoutItem[]): Map<string, WeekDayLayoutPosition> {
  const result = new Map<string, WeekDayLayoutPosition>();
  if (group.length === 0) return result;

  const sorted = [...group].sort(
    (a, b) => a.startMs - b.startMs || (a.kind === "owner" ? -1 : 1)
  );

  const columnEnds: number[] = [];
  const assignedCol = new Map<string, number>();

  for (const item of sorted) {
    let col = -1;

    if (item.kind === "deputy") {
      const ownerCol = assignedCol.get(`${item.pairId}-owner`);
      if (ownerCol !== undefined) {
        const preferred = ownerCol + 1;
        if (preferred < columnEnds.length && columnEnds[preferred] <= item.startMs) {
          col = preferred;
        }
      }
    }

    if (col === -1) {
      col = columnEnds.findIndex((end) => end <= item.startMs);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(0);
      }
    }

    columnEnds[col] = item.endMs;
    assignedCol.set(item.id, col);
  }

  const columnCount = Math.max(1, columnEnds.length);
  for (const item of group) {
    const column = assignedCol.get(item.id) ?? 0;
    result.set(item.id, { column, columnCount });
  }
  return result;
}

/** Přiřadí sloupce pro překrývající se bloky v jednom dni. */
export function layoutWeekDayColumns(
  items: WeekDayLayoutItem[]
): Map<string, WeekDayLayoutPosition> {
  const result = new Map<string, WeekDayLayoutPosition>();
  for (const group of buildOverlapGroups(items)) {
    const groupLayout = layoutOverlapGroup(group);
    for (const [id, pos] of groupLayout) {
      result.set(id, pos);
    }
  }
  return result;
}

/** Indexy sloupců týdne (0–6) pro vícedenní celodenní událost. */
export function computeAllDayWeekSpan(
  weekDayYmds: string[],
  displayDates: string[]
): { startIdx: number; endIdx: number } | null {
  const indices: number[] = [];
  for (const ymd of displayDates) {
    const idx = weekDayYmds.indexOf(ymd);
    if (idx >= 0) indices.push(idx);
  }
  if (indices.length === 0) return null;
  return {
    startIdx: Math.min(...indices),
    endIdx: Math.max(...indices),
  };
}

/** Je celodenní událost vícedenní v rámci zobrazených dnů? */
export function isMultiDayAllDay(displayDates: string[]): boolean {
  return displayDates.length > 1;
}

/** Položka pro výpočet řádků vícedenních pruhů v řádku „Celý den“. */
export type AllDaySpanBar = {
  id: string;
  pairId?: string;
  kind?: "owner" | "deputy" | "module" | "personal";
  startIdx: number;
  endIdx: number;
};

export type AllDaySpanRowPosition = {
  row: number;
  rowCount: number;
};

function spanBarsOverlap(a: AllDaySpanBar, b: AllDaySpanBar): boolean {
  return a.startIdx <= b.endIdx && b.startIdx <= a.endIdx;
}

function buildSpanOverlapGroups(bars: AllDaySpanBar[]): AllDaySpanBar[][] {
  const remaining = [...bars];
  const groups: AllDaySpanBar[][] = [];

  while (remaining.length > 0) {
    const group: AllDaySpanBar[] = [remaining.pop()!];
    let i = 0;
    while (i < group.length) {
      const cur = group[i];
      for (let j = remaining.length - 1; j >= 0; j--) {
        if (spanBarsOverlap(cur, remaining[j])) {
          group.push(remaining[j]);
          remaining.splice(j, 1);
        }
      }
      i++;
    }
    groups.push(group);
  }
  return groups;
}

function layoutSpanOverlapGroup(group: AllDaySpanBar[]): Map<string, AllDaySpanRowPosition> {
  const result = new Map<string, AllDaySpanRowPosition>();
  if (group.length === 0) return result;

  const sorted = [...group].sort(
    (a, b) =>
      a.startIdx - b.startIdx ||
      (a.kind === "owner" || a.kind === "personal" ? -1 : a.kind === "deputy" ? 0 : 1)
  );

  const rowRanges: Array<Array<{ startIdx: number; endIdx: number }>> = [];
  const assignedRow = new Map<string, number>();

  const overlapsInRow = (row: number, bar: AllDaySpanBar): boolean => {
    const ranges = rowRanges[row] ?? [];
    return ranges.some(
      (rng) => bar.startIdx <= rng.endIdx && rng.startIdx <= bar.endIdx
    );
  };

  for (const bar of sorted) {
    let row = -1;

    if (bar.kind === "deputy" && bar.pairId) {
      const ownerRow = assignedRow.get(`${bar.pairId}-owner`);
      if (ownerRow !== undefined) {
        const preferred = ownerRow + 1;
        if (!overlapsInRow(preferred, bar)) {
          row = preferred;
        }
      }
    }

    if (row === -1) {
      for (let r = 0; r < rowRanges.length; r++) {
        if (!overlapsInRow(r, bar)) {
          row = r;
          break;
        }
      }
      if (row === -1) {
        row = rowRanges.length;
      }
    }

    if (!rowRanges[row]) rowRanges[row] = [];
    rowRanges[row].push({ startIdx: bar.startIdx, endIdx: bar.endIdx });
    assignedRow.set(bar.id, row);
  }

  const rowCount = Math.max(1, rowRanges.length);
  for (const bar of group) {
    result.set(bar.id, { row: assignedRow.get(bar.id) ?? 0, rowCount });
  }
  return result;
}

/** Přiřadí řádky pro překrývající se vícedenní pruhy v řádku „Celý den“. */
export function layoutAllDaySpanRows(
  bars: AllDaySpanBar[]
): Map<string, AllDaySpanRowPosition> {
  const result = new Map<string, AllDaySpanRowPosition>();
  let rowOffset = 0;

  const groups = buildSpanOverlapGroups(bars).sort(
    (a, b) => Math.min(...a.map((bar) => bar.startIdx)) - Math.min(...b.map((bar) => bar.startIdx))
  );

  for (const group of groups) {
    const groupLayout = layoutSpanOverlapGroup(group);
    let maxRowInGroup = 0;
    for (const pos of groupLayout.values()) {
      maxRowInGroup = Math.max(maxRowInGroup, pos.row);
    }
    for (const [id, pos] of groupLayout) {
      result.set(id, { row: pos.row + rowOffset, rowCount: 0 });
    }
    rowOffset += maxRowInGroup + 1;
  }

  const totalRowCount = rowOffset;
  for (const [id, pos] of result) {
    result.set(id, { row: pos.row, rowCount: totalRowCount });
  }
  return result;
}
