import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { StickyNote } from "lucide-react";
import { renderMentions, type MentionUser } from "@/lib/projekty/mentions";
import { EmptyState } from "@/components/projekty/ui/empty-state";
import { UserAvatar } from "@/components/projekty/UserAvatar";

type TimelineNote = {
  id: string;
  content: string;
  createdAt: Date | string;
  author: { id: number; name: string | null; email: string | null; image: string | null } | null;
};

export function NotesTimeline({
  notes,
  users,
}: {
  notes: TimelineNote[];
  users: MentionUser[];
}) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={StickyNote}
        title="Zatím žádné poznámky"
        description="Napiš první poznámku k tomuto záznamu níže."
      />
    );
  }
  return (
    <ol className="space-y-3">
      {notes.map((n) => {
        const d = typeof n.createdAt === "string" ? new Date(n.createdAt) : n.createdAt;
        return (
          <li key={n.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                {n.author ? (
                  <UserAvatar user={n.author} size="xs" />
                ) : (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">
                    ?
                  </span>
                )}
                {n.author?.name ?? n.author?.email ?? "(smazaný uživatel)"}
              </span>
              <time className="text-muted-foreground">{format(d, "d. M. yyyy HH:mm", { locale: cs })}</time>
            </div>
            <div
              className="mt-2 whitespace-pre-wrap text-sm [&_.mention]:rounded [&_.mention]:bg-blue-100 [&_.mention]:px-1 [&_.mention]:text-blue-900 dark:[&_.mention]:bg-blue-900/40 dark:[&_.mention]:text-blue-200"
              dangerouslySetInnerHTML={{ __html: renderMentions(n.content, users) }}
            />
          </li>
        );
      })}
    </ol>
  );
}
