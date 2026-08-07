import type { MaketyWorkType } from "@/lib/makety-work-type";

export type MaketyCommentParticipantRole =
  | "zadavatel"
  | "assignee"
  | "prepress"
  | "final";

export type MaketyCommentParticipant = {
  userId: number;
  firstName: string;
  lastName: string;
  role: MaketyCommentParticipantRole;
  roleLabel: string;
};

type UserName = { id: number; first_name: string; last_name: string };

function personLabel(role: MaketyCommentParticipantRole, workType: MaketyWorkType): string {
  switch (role) {
    case "zadavatel":
      return "Zadavatel";
    case "assignee":
      return workType === "grafika" ? "Grafik" : "Výrobce";
    case "prepress":
      return "Prepress";
    case "final":
      return "Finální";
  }
}

/**
 * Účastníci zakázky, které lze upozornit komentářem.
 * Deduplikace podle userId (první role vyhrává: zadavatel → assignee → prepress → final).
 */
export function buildMaketyCommentParticipants(input: {
  workType: MaketyWorkType;
  excludeUserId?: number | null;
  creator: UserName;
  assignee: UserName | null;
  prepress?: UserName | null;
  finalApprover?: UserName | null;
}): MaketyCommentParticipant[] {
  const ordered: Array<{ role: MaketyCommentParticipantRole; user: UserName | null | undefined }> = [
    { role: "zadavatel", user: input.creator },
    { role: "assignee", user: input.assignee },
  ];
  if (input.workType === "grafika") {
    ordered.push(
      { role: "prepress", user: input.prepress },
      { role: "final", user: input.finalApprover }
    );
  }

  const seen = new Set<number>();
  const out: MaketyCommentParticipant[] = [];
  for (const { role, user } of ordered) {
    if (!user) continue;
    if (input.excludeUserId != null && user.id === input.excludeUserId) continue;
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    out.push({
      userId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      role,
      roleLabel: personLabel(role, input.workType),
    });
  }
  return out;
}

export function parseNotifyUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const v of raw) {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
  }
  return ids;
}
