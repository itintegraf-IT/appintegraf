/** URL fotky nebo přílohy položky — vždy přes API s kontrolou oprávnění, ne přímo do /uploads. */
export function equipmentFileUrl(equipmentId: number, fileId: number, opts?: { download?: boolean }): string {
  const url = `/api/equipment/${equipmentId}/files/${fileId}`;
  return opts?.download ? `${url}?download=1` : url;
}
