import { StickyNote } from "lucide-react";
import type { MentionUser } from "@/lib/crm/mentions";
import { EmptyState } from "@/components/ui/empty-state";
import { NoteRow, type EditableNote } from "@/components/crm/NoteRow";
import type { Role } from "@/lib/crm/rbac";

type Props = {
  notes: EditableNote[];
  users: MentionUser[];
  currentUser: { id: number; role: Role };
};

export function NotesTimeline({ notes, users, currentUser }: Props) {
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
        const canEdit =
          currentUser.role !== "VIEWER" &&
          (currentUser.role === "ADMIN" || n.author?.id === currentUser.id);
        return <NoteRow key={n.id} note={n} users={users} canEdit={canEdit} />;
      })}
    </ol>
  );
}
