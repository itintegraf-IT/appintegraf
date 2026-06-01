/** Odkaz z položky kalendářové mřížky (událost / úkol / maketa). */
export function calendarGridItemHref(item: {
  id: number;
  ukoly_task_id?: number | null;
  makety_task_id?: number | null;
}): string {
  if (item.ukoly_task_id != null) return `/ukoly/${item.ukoly_task_id}`;
  if (item.makety_task_id != null) return `/makety/${item.makety_task_id}`;
  return `/calendar/${item.id}`;
}

export function calendarGridItemKey(item: {
  id: number;
  ukoly_task_id?: number | null;
  makety_task_id?: number | null;
}): string {
  if (item.ukoly_task_id != null) return `ukol-${item.ukoly_task_id}`;
  if (item.makety_task_id != null) return `maketa-${item.makety_task_id}`;
  return `cal-${item.id}`;
}
