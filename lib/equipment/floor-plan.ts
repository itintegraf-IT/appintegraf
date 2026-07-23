export type PlanPoint = { x: number; y: number };

export function parseRoomPolygon(raw: unknown): PlanPoint[] | null {
  if (raw == null || raw === "") return null;
  let data: unknown = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(data) || data.length < 3) return null;
  const points: PlanPoint[] = [];
  for (const p of data) {
    if (!p || typeof p !== "object") return null;
    const x = Number((p as { x?: unknown }).x);
    const y = Number((p as { y?: unknown }).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return null;
    points.push({
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    });
  }
  return points.length >= 3 ? points : null;
}

export function serializeRoomPolygon(points: PlanPoint[]): string {
  return JSON.stringify(
    points.map((p) => ({
      x: Math.round(p.x * 10000) / 10000,
      y: Math.round(p.y * 10000) / 10000,
    }))
  );
}

/** Ray-casting: je bod uvnitř polygonu? */
export function pointInPolygon(point: PlanPoint, polygon: PlanPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function centroidOfPolygon(polygon: PlanPoint[]): PlanPoint {
  let x = 0;
  let y = 0;
  for (const p of polygon) {
    x += p.x;
    y += p.y;
  }
  const n = polygon.length || 1;
  return { x: x / n, y: y / n };
}

const PLAN_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
  "#0ea5e9",
];

export function defaultPlanColor(seed: number | string): string {
  const n =
    typeof seed === "number"
      ? seed
      : [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PLAN_COLORS[Math.abs(n) % PLAN_COLORS.length];
}
