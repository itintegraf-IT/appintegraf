/** Odkaz z položky kalendářové mřížky (událost vs úkol z modulu Úkoly). */
export function calendarGridItemHref(item: { id: number; ukoly_task_id?: number | null }): string {
  if (item.ukoly_task_id != null) return `/ukoly/${item.ukoly_task_id}`;
  return `/calendar/${item.id}`;
}

export function calendarGridItemKey(item: { id: number; ukoly_task_id?: number | null }): string {
  return item.ukoly_task_id != null ? `ukol-${item.ukoly_task_id}` : `cal-${item.id}`;
}
