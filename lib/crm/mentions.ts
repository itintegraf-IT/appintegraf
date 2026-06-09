export type MentionUser = { id: number; email: string | null; name: string | null };

const MENTION_REGEX = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

export function extractMentions(content: string, users: MentionUser[]): number[] {
  const ids = new Set<number>();
  const matches = content.matchAll(MENTION_REGEX);
  for (const m of matches) {
    const emailRaw = m[1];
    if (!emailRaw) continue;
    const email = emailRaw.toLowerCase();
    const user = users.find((u) => u.email != null && u.email.toLowerCase() === email);
    if (user) ids.add(user.id);
  }
  return [...ids];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

export function renderMentions(content: string, users: MentionUser[]): string {
  return escapeHtml(content).replace(MENTION_REGEX, (full, email: string) => {
    const user = users.find((u) => u.email != null && u.email.toLowerCase() === email.toLowerCase());
    if (!user) return full;
    const label = user.name ?? user.email ?? user.id;
    return `<span class="mention" data-user-id="${String(user.id)}">@${escapeHtml(String(label))}</span>`;
  });
}
