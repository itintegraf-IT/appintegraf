"use client";

import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useIsTouchDevice } from "@/hooks/projekty/useIsTouchDevice";

/**
 * Vrací sensors pro <DndContext> adaptované podle typu inputu:
 * - Desktop (pointer: fine): activationConstraint { distance: 8 } — drag začne po 8px pohybu
 * - Touch (pointer: coarse): activationConstraint { delay: 200, tolerance: 5 } — drag začne po 200ms long-pressu
 *
 * Důvod pro long-press na touch: bez delay constraintu by vertikální scroll
 * listu spustil drag (prst snadno udělá 8px při scroll gestu). Trade-off:
 * desktop user musí pohnout o 8px, mobile user musí podržet 200ms. Oba
 * thresholds jsou v Trello/Notion ranges.
 *
 * Per ADR 0029.
 */
export function useResponsiveSensors() {
  const isTouch = useIsTouchDevice();
  const sensor = useSensor(
    PointerSensor,
    isTouch
      ? { activationConstraint: { delay: 200, tolerance: 5 } }
      : { activationConstraint: { distance: 8 } },
  );
  return useSensors(sensor);
}
