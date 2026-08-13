"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import {
  maketaPriorityBadgeClass,
  maketaPriorityLabel,
  maketaStatusBadgeClass,
  maketaStatusLabel,
  type MaketaPriority,
} from "@/lib/makety-status";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";

type QueueItem = {
  id: number;
  body: string;
  order_number: string | null;
  priority: string;
  queue_position: number | null;
  due_at: string;
  status: string;
  assignee_user_id: number | null;
  creator: string | null;
};

type AssigneeGroup = {
  assignee: { id: number; first_name: string; last_name: string };
  items: QueueItem[];
};

type Props = {
  initialTab: MaketyWorkType;
};

function SortableQueueRow({
  item,
  index,
  workType,
  onPriorityChange,
}: {
  item: QueueItem;
  index: number;
  workType: MaketyWorkType;
  onPriorityChange: (id: number, priority: MaketaPriority) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
        aria-label="Přesunout"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="w-6 text-center text-sm font-semibold text-gray-500">{index + 1}</span>
      <div className="min-w-[120px] text-sm text-gray-700">
        {formatDateTimeCz(new Date(item.due_at))}
      </div>
      <select
        value={item.priority}
        onChange={(e) => onPriorityChange(item.id, e.target.value as MaketaPriority)}
        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="normal">Normální</option>
        <option value="high">Vysoká</option>
        <option value="urgent">Urgentní</option>
      </select>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(item.status)}`}
      >
        {maketaStatusLabel(item.status)}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/makety/${item.id}`} className="font-medium text-violet-600 hover:underline">
          {item.order_number
            ? `Zak. ${item.order_number}`
            : `${maketyWorkTypeLabel(workType)} #${item.id}`}
        </Link>
        <p className="truncate text-sm text-gray-600">
          {item.body.replace(/\s+/g, " ").trim().slice(0, 80)}
        </p>
        {item.creator && <p className="text-xs text-gray-400">Zadal/a: {item.creator}</p>}
      </div>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaPriorityBadgeClass(item.priority)}`}
      >
        {maketaPriorityLabel(item.priority)}
      </span>
    </div>
  );
}

function AssigneeQueueBlock({
  group,
  workType,
  onReorder,
  onPriorityChange,
}: {
  group: AssigneeGroup;
  workType: MaketyWorkType;
  onReorder: (assigneeId: number, orderedIds: number[]) => Promise<void>;
  onPriorityChange: (id: number, priority: MaketaPriority) => void;
}) {
  const [items, setItems] = useState(group.items);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(group.items);
  }, [group.items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setSaving(true);
    try {
      await onReorder(
        group.assignee.id,
        next.map((i) => i.id)
      );
    } catch {
      setItems(group.items);
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          {group.assignee.first_name} {group.assignee.last_name}
        </h3>
        {saving && <span className="text-xs text-violet-600">Ukládám pořadí…</span>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <SortableQueueRow
                key={item.id}
                item={item}
                index={idx}
                workType={workType}
                onPriorityChange={onPriorityChange}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {items.length === 0 && (
        <p className="text-sm text-gray-500">Žádná aktivní zakázka v této frontě.</p>
      )}
    </div>
  );
}

export function MaketyQueueDashboard({ initialTab }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<MaketyWorkType>(initialTab);
  const [groups, setGroups] = useState<AssigneeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (workType: MaketyWorkType) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/makety/queue?work_type=${workType}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Načtení se nezdařilo");
        setGroups([]);
        return;
      }
      setGroups(data.groups ?? []);
    } catch {
      setError("Síťová chyba");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const switchTab = (next: MaketyWorkType) => {
    setTab(next);
    const q = next === "grafika" ? "?tab=grafika" : "";
    router.replace(`/makety/fronta${q}`);
  };

  const handleReorder = async (assigneeId: number, orderedIds: number[]) => {
    const res = await fetch("/api/makety/queue/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        work_type: tab,
        assignee_user_id: assigneeId,
        orderedIds,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Uložení pořadí se nezdařilo");
    }
    await load(tab);
  };

  const handlePriorityChange = async (id: number, priority: MaketaPriority) => {
    const res = await fetch(`/api/makety/${id}/priority`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    if (res.ok) {
      await load(tab);
    }
  };

  const tabClass = (active: boolean) =>
    `rounded-lg border px-4 py-2 text-sm font-medium ${
      active
        ? "border-violet-200 bg-violet-50 text-violet-700"
        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
    }`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Přetahujte zakázky pro změnu pořadí ve frontě výroby. Pořadí platí pro každého výrobce zvlášť.
        Prioritu měníte v rozbalovacím seznamu — v kalendáři se projeví jako barva (vysoká = oranžová,
        urgentní = červená). Po úpravě otevřete nebo obnovte příslušný kalendář maket nebo grafiky.
      </p>

      <div className="flex gap-2">
        <button type="button" className={tabClass(tab === "maketa")} onClick={() => switchTab("maketa")}>
          Makety
        </button>
        <button type="button" className={tabClass(tab === "grafika")} onClick={() => switchTab("grafika")}>
          Grafika
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Načítám frontu…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">Žádné aktivní zakázky k řazení.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <AssigneeQueueBlock
              key={g.assignee.id}
              group={g}
              workType={tab}
              onReorder={handleReorder}
              onPriorityChange={handlePriorityChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
