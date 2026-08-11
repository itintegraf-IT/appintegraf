"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import {
  getMaketyListColumnMeta,
  isMaketyListColumnDraggable,
  type MaketyListColumnId,
} from "@/lib/makety/makety-list-columns";

type SortableOrderItemProps = {
  id: MaketyListColumnId;
  label: string;
};

function SortableOrderItem({ id, label }: SortableOrderItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-sm text-gray-800"
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 active:cursor-grabbing"
        aria-label={`Přesunout ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="truncate">{label}</span>
    </li>
  );
}

type Props = {
  columnIds: MaketyListColumnId[];
  canModuleAdmin: boolean;
  onReorder: (activeId: MaketyListColumnId, overId: MaketyListColumnId) => void;
};

export function MaketyListColumnOrderList({ columnIds, canModuleAdmin, onReorder }: Props) {
  const draggableIds = columnIds.filter((id) => isMaketyListColumnDraggable(id, canModuleAdmin));
  if (draggableIds.length < 2) return null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(active.id as MaketyListColumnId, over.id as MaketyListColumnId);
  };

  return (
    <div className="mb-3 border-b border-gray-100 pb-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        Pořadí sloupců
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={draggableIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {draggableIds.map((id) => {
              const meta = getMaketyListColumnMeta(id);
              if (!meta) return null;
              return <SortableOrderItem key={id} id={id} label={meta.label} />;
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="mt-2 text-xs text-gray-500">Přetáhněte nebo uchopte sloupce v hlavičce tabulky.</p>
    </div>
  );
}
