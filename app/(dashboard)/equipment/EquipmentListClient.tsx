"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  LayoutGrid,
  List,
  MapPin,
  Printer,
  QrCode,
  UserPlus,
} from "lucide-react";
import type {
  EquipmentListSortDir,
  EquipmentListSortKey,
  EquipmentListView,
} from "@/lib/equipment-list-sort";
import { formatEquipmentPrice } from "@/lib/equipment/format-price";
import { EquipmentTableActions } from "./EquipmentTableActions";
import { isEquipmentAssignedStatus } from "@/lib/equipment-status";

export type EquipmentListRow = {
  id: number;
  name: string;
  brandModel: string;
  serialNumber: string | null;
  categoryName: string | null;
  responsibleName: string | null;
  status: string | null;
  quantity?: number | null;
  assignedToName: string | null;
  assignedToUserId: number | null;
  assignmentId: number | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  ageText: string;
  ageFromRecord: boolean;
};

type RoomOpt = { id: number; name: string; code: string };
type UserOpt = { id: number; first_name: string; last_name: string };

type Props = {
  rows: EquipmentListRow[];
  sort: EquipmentListSortKey;
  dir: EquipmentListSortDir;
  view: EquipmentListView;
  unassigned?: boolean;
  canEdit: boolean;
  canAssign: boolean;
  canDelete: boolean;
};

function buildHref(
  sort: EquipmentListSortKey,
  dir: EquipmentListSortDir,
  view: EquipmentListView,
  unassigned?: boolean
) {
  const q = new URLSearchParams();
  q.set("scope", "all");
  if (sort !== "zapis") q.set("sort", sort);
  if (dir !== (sort === "zapis" ? "desc" : "asc")) q.set("dir", dir);
  if (view !== "table") q.set("view", view);
  if (unassigned) q.set("unassigned", "1");
  return `/equipment?${q.toString()}`;
}

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("cs-CZ") : "-";
}

function personLabel(u: UserOpt) {
  return `${u.last_name} ${u.first_name}`.trim();
}

function groupByUser(rows: EquipmentListRow[]) {
  const map = new Map<string, EquipmentListRow[]>();
  for (const row of rows) {
    const key = row.assignedToUserId != null ? String(row.assignedToUserId) : "__none__";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, items]) => ({
      key,
      userName: key === "__none__" ? "Nepřiřazeno" : items[0]?.assignedToName ?? "—",
      items,
    }))
    .sort((a, b) => {
      if (a.key === "__none__") return 1;
      if (b.key === "__none__") return -1;
      return a.userName.localeCompare(b.userName, "cs", { sensitivity: "base" });
    });
}

export function EquipmentListClient({
  rows,
  sort,
  dir,
  view,
  unassigned = false,
  canEdit,
  canAssign,
  canDelete,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [rooms, setRooms] = useState<RoomOpt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [toRoom, setToRoom] = useState("");
  const [toUser, setToUser] = useState("");
  const [busy, setBusy] = useState<"room" | "user" | "print" | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setSelected([]);
  }, [rows]);

  useEffect(() => {
    fetch("/api/equipment/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(Array.isArray(d) ? d : []))
      .catch(() => undefined);
    if (canAssign) {
      fetch("/api/equipment/users")
        .then((r) => r.json())
        .then((d) => setUsers(Array.isArray(d) ? d : []))
        .catch(() => undefined);
    }
  }, [canAssign]);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));

  const navigate = (nextSort: EquipmentListSortKey, nextDir: EquipmentListSortDir, nextView: EquipmentListView) => {
    router.push(buildHref(nextSort, nextDir, nextView, unassigned));
  };

  const toggle = (id: number) => {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : allIds);
  };

  const placeToRoom = async () => {
    if (selected.length === 0 || !toRoom) return;
    setErr("");
    setMsg("");
    setBusy("room");
    try {
      const res = await fetch("/api/equipment/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_ids: selected,
          to_room_id: parseInt(toRoom, 10),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Přesun se nezdařil");
        return;
      }
      setMsg(`Umístěno ${data.results?.length ?? selected.length} položek.`);
      setSelected([]);
      router.refresh();
    } catch {
      setErr("Přesun se nezdařil");
    } finally {
      setBusy(null);
    }
  };

  const assignHolder = async () => {
    if (selected.length === 0 || !toUser) return;
    setErr("");
    setMsg("");
    setBusy("user");
    try {
      const res = await fetch("/api/equipment/assign-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment_ids: selected,
          user_id: parseInt(toUser, 10),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Přiřazení se nezdařilo");
        return;
      }
      const extra = Array.isArray(data.errors) && data.errors.length ? ` (${data.errors.length} chyb)` : "";
      setMsg(`Přiřazeno držiteli: ${data.assigned ?? 0}${extra}`);
      if (data.errors?.length) setErr(data.errors.slice(0, 5).join("; "));
      setSelected([]);
      router.refresh();
    } catch {
      setErr("Přiřazení se nezdařilo");
    } finally {
      setBusy(null);
    }
  };

  const printLabels = async () => {
    if (selected.length === 0) return;
    setErr("");
    setMsg("");
    setBusy("print");
    try {
      const res = await fetch("/api/equipment/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error ?? "Tisk se nezdařil");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "majetek-stitky.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`PDF štítků (${selected.length} ks, A4) ke stažení.`);
    } catch {
      setErr("Tisk se nezdařil");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Položek vybavení: <strong>{rows.length}</strong>
          {selected.length > 0 ? (
            <>
              {" "}
              · vybráno <strong>{selected.length}</strong>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/equipment/scan"
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            <QrCode className="h-4 w-4" />
            {unassigned ? "Spárovat s místností" : "Skenovat a spárovat"}
          </Link>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">Řadit podle:</span>
            <select
              value={sort}
              onChange={(e) => {
                const next = e.target.value as EquipmentListSortKey;
                const defaultDir: EquipmentListSortDir = next === "zapis" ? "desc" : "asc";
                navigate(next, defaultDir, view);
              }}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="zapis">Zápis (ID)</option>
              <option value="nazev">Název</option>
              <option value="znacka">Značka / Model</option>
              <option value="kategorie">Kategorie</option>
              <option value="uzivatel">Uživatel</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => navigate(sort, dir === "asc" ? "desc" : "asc", view)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            title={dir === "asc" ? "Vzestupně" : "Sestupně"}
          >
            {dir === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}
            {dir === "asc" ? "Vzestupně" : "Sestupně"}
          </button>
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            <button
              type="button"
              onClick={() => navigate(sort, dir, "table")}
              className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${
                view === "table" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <List className="h-4 w-4" />
              Seznam
            </button>
            <button
              type="button"
              onClick={() => navigate(sort, dir, "cards")}
              className={`flex items-center gap-1 rounded px-3 py-1 text-sm ${
                view === "cards" ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Karty
            </button>
          </div>
        </div>
      </div>

      {canEdit || canAssign ? (
        <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Vybrat vše
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={toRoom}
                onChange={(e) => setToRoom(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Místnost…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} – {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={selected.length === 0 || !toRoom || busy != null}
                onClick={() => void placeToRoom()}
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <MapPin className="h-4 w-4" />
                {busy === "room" ? "Umísťuji…" : "Umístit do místnosti"}
              </button>
            </div>
            {canAssign ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={toUser}
                  onChange={(e) => setToUser(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Držitel…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {personLabel(u)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={selected.length === 0 || !toUser || busy != null}
                  onClick={() => void assignHolder()}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {busy === "user" ? "Přiřazuji…" : "Přiřadit držiteli"}
                </button>
              </div>
            ) : null}
            <button
              type="button"
              disabled={selected.length === 0 || busy != null}
              onClick={() => void printLabels()}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {busy === "print" ? "Připravuji PDF…" : "Tisk QR (A4)"}
            </button>
          </div>
          {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-gray-500">Žádné vybavení</div>
      ) : view === "cards" ? (
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          {groupByUser(rows).map((group) => (
            <div key={group.key} className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                <h3 className="font-semibold text-gray-900">{group.userName}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "položka" : group.items.length < 5 ? "položky" : "položek"}
                </p>
              </div>
              <ul className="divide-y divide-gray-100">
                {group.items.map((row) => (
                  <li key={row.id} className="px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.includes(row.id)}
                          onChange={() => toggle(row.id)}
                        />
                        <div className="min-w-0">
                          <Link href={`/equipment/${row.id}`} className="font-medium text-red-700 hover:underline">
                            {row.name}
                            {row.quantity != null && row.quantity > 1 ? (
                              <span className="ml-2 text-xs font-normal text-gray-500">Ks: {row.quantity}</span>
                            ) : null}
                          </Link>
                          {row.brandModel ? <p className="text-xs text-gray-500">{row.brandModel}</p> : null}
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                            {row.categoryName ? (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5">{row.categoryName}</span>
                            ) : null}
                            <span>Zodp.: {row.responsibleName ?? "—"}</span>
                            <span className="font-mono">S/N: {row.serialNumber ?? "—"}</span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5">{row.status ?? "—"}</span>
                            <span>Stáří: {row.ageText}</span>
                            <span>Nákup: {formatDate(row.purchaseDate)}</span>
                            <span>Cena: {formatEquipmentPrice(row.purchasePrice)}</span>
                          </div>
                        </div>
                      </div>
                      <EquipmentTableActions
                        equipmentId={row.id}
                        assignmentId={row.assignmentId}
                        canEdit={canEdit}
                        canAssign={canAssign}
                        canDelete={canDelete}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Značka / Model</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sériové č.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kategorie</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Zodpovědná osoba</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nákup</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cena</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stáří</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.name}
                    {row.quantity != null && row.quantity > 1 ? (
                      <span className="ml-2 text-xs font-normal text-gray-500">Ks: {row.quantity}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.brandModel || "-"}</td>
                  <td className="px-4 py-3 font-mono text-sm">{row.serialNumber ?? "-"}</td>
                  <td className="px-4 py-3">{row.categoryName ?? "-"}</td>
                  <td className="px-4 py-3 text-sm">{row.responsibleName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="w-fit rounded bg-gray-100 px-2 py-0.5 text-sm">{row.status ?? "-"}</span>
                      {row.assignedToName || isEquipmentAssignedStatus(row.status) ? (
                        <span className="max-w-[14rem] text-xs leading-snug text-gray-600">
                          <span className="text-gray-400">Držitel: </span>
                          {row.assignedToName ?? "—"}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(row.purchaseDate)}</td>
                  <td className="px-4 py-3 font-medium">{formatEquipmentPrice(row.purchasePrice)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-gray-900">{row.ageText}</span>
                      {row.ageFromRecord ? (
                        <span className="text-xs text-gray-500">od zápisu (chybí nákup)</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <EquipmentTableActions
                      equipmentId={row.id}
                      assignmentId={row.assignmentId}
                      canEdit={canEdit}
                      canAssign={canAssign}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
