"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Crosshair,
  Hand,
  Map,
  MousePointer2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  centroidOfPolygon,
  defaultPlanColor,
  pointInPolygon,
  type PlanPoint,
} from "@/lib/equipment/floor-plan";

type PlanSummary = {
  id: number;
  name: string;
  floor_label: string;
  building: string | null;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  updated_at?: string;
  _count?: { rooms: number };
};

type RoomItem = {
  id: number;
  name: string;
  asset_tag: string | null;
  status: string | null;
  equipment_categories?: { name: string };
};

type PlanRoom = {
  id: number;
  name: string;
  code: string;
  floor_plan_id: number | null;
  polygon: PlanPoint[] | null;
  plan_color: string | null;
  _count?: { equipment_items: number };
  items?: RoomItem[];
};

type PlanDetail = PlanSummary & {
  rooms: PlanRoom[];
};

type Mode = "view" | "draw" | "pan";

export default function FloorPlanClient({
  canAdmin,
  canWrite,
}: {
  canAdmin: boolean;
  canWrite: boolean;
}) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [mode, setMode] = useState<Mode>("view");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [draft, setDraft] = useState<PlanPoint[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [roomItems, setRoomItems] = useState<RoomItem[]>([]);
  const [hoverRoomId, setHoverRoomId] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [newRoomForm, setNewRoomForm] = useState({ name: "", code: "", color: "" });
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [createPlanForm, setCreatePlanForm] = useState({
    name: "",
    floor_label: "1NP",
    building: "",
  });
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [assignTab, setAssignTab] = useState<"create" | "link">("create");
  const [linkRoomId, setLinkRoomId] = useState("");
  const [linkableRooms, setLinkableRooms] = useState<
    {
      id: number;
      name: string;
      code: string;
      building: string | null;
      floor: string | null;
      plan_color: string | null;
      polygon_json: string | null;
      floor_plan_id: number | null;
    }[]
  >([]);
  const [imageLoadError, setImageLoadError] = useState("");
  const [imageBust, setImageBust] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const spaceDown = useRef(false);

  const loadPlans = useCallback(async () => {
    const res = await fetch("/api/equipment/floor-plans");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba načtení půdorysů");
      setPlans([]);
      return;
    }
    const list = Array.isArray(data) ? data : [];
    setPlans(list);
    setPlanId((prev) => prev ?? (list[0]?.id ?? null));
  }, []);

  const loadPlan = useCallback(async (id: number) => {
    const res = await fetch(`/api/equipment/floor-plans/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Chyba načtení plánu");
      setPlan(null);
      return;
    }
    setPlan(data);
    setImageLoadError("");
    setError("");
  }, []);

  const cancelDraft = useCallback(() => {
    setDraft([]);
    setShowAssignPanel(false);
    setLinkRoomId("");
    setAssignTab("create");
    setMode("view");
  }, []);

  const finishShape = useCallback(() => {
    setShowAssignPanel(true);
    setAssignTab("create");
  }, []);

  const applyRoomToForm = useCallback(
    (room: { id: number; name: string; code: string; plan_color?: string | null }) => {
      setNewRoomForm({
        name: room.name,
        code: room.code,
        color: room.plan_color ?? defaultPlanColor(room.id),
      });
    },
    []
  );

  const linkRoomPreview = useMemo(() => {
    if (!linkRoomId) return null;
    return linkableRooms.find((r) => String(r.id) === linkRoomId) ?? null;
  }, [linkRoomId, linkableRooms]);

  const loadLinkableRooms = useCallback(async () => {
    const res = await fetch("/api/equipment/rooms?all=1");
    const data = await res.json().catch(() => []);
    if (!Array.isArray(data)) {
      setLinkableRooms([]);
      return;
    }
    setLinkableRooms(
      data.filter(
        (r: { polygon_json?: string | null; is_active?: boolean | null }) =>
          r.is_active !== false && !r.polygon_json
      )
    );
  }, []);

  useEffect(() => {
    if (showAssignPanel && canAdmin) void loadLinkableRooms();
  }, [showAssignPanel, canAdmin, loadLinkableRooms]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (planId != null) {
      setImageLoadError("");
      void loadPlan(planId);
    }
  }, [planId, loadPlan]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = true;
        if (e.target instanceof HTMLElement) {
          const tag = e.target.tagName;
          if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
            e.preventDefault();
          }
        }
      }
      if (e.key === "Escape") {
        cancelDraft();
      }
      if (e.key === "Enter") {
        const tag =
          e.target instanceof HTMLElement ? e.target.tagName : "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") {
          return;
        }
        if (draft.length >= 3 && !showAssignPanel) {
          e.preventDefault();
          finishShape();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [cancelDraft, draft.length, finishShape, showAssignPanel]);

  const selectedRoom = useMemo(
    () => plan?.rooms.find((r) => r.id === selectedRoomId) ?? null,
    [plan, selectedRoomId]
  );
  const hoverRoom = useMemo(
    () => plan?.rooms.find((r) => r.id === hoverRoomId) ?? null,
    [plan, hoverRoomId]
  );
  const hoverItems = hoverRoom?.items ?? [];

  useEffect(() => {
    if (!selectedRoomId) {
      setRoomItems([]);
      return;
    }
    const fromPlan = plan?.rooms.find((r) => r.id === selectedRoomId);
    if (fromPlan) {
      applyRoomToForm(fromPlan);
    }
    fetch(`/api/equipment/rooms/${selectedRoomId}`)
      .then((r) => r.json())
      .then((d) => {
        setRoomItems(Array.isArray(d.items) ? d.items : []);
        if (d?.id && d.name && d.code) {
          applyRoomToForm({
            id: d.id,
            name: d.name,
            code: d.code,
            plan_color: d.plan_color,
          });
        }
      })
      .catch(() => setRoomItems([]));
  }, [selectedRoomId, plan?.rooms, applyRoomToForm]);

  const imgNatural = {
    w: plan?.image_width || imgRef.current?.naturalWidth || 1200,
    h: plan?.image_height || imgRef.current?.naturalHeight || 800,
  };

  const toNorm = (clientX: number, clientY: number): PlanPoint | null => {
    const vp = viewportRef.current;
    if (!vp) return null;
    const rect = vp.getBoundingClientRect();
    const x = (clientX - rect.left - offset.x) / scale;
    const y = (clientY - rect.top - offset.y) / scale;
    if (x < 0 || y < 0 || x > imgNatural.w || y > imgNatural.h) return null;
    return { x: x / imgNatural.w, y: y / imgNatural.h };
  };

  const findRoomAt = (p: PlanPoint): PlanRoom | null => {
    if (!plan) return null;
    for (let i = plan.rooms.length - 1; i >= 0; i--) {
      const r = plan.rooms[i];
      if (r.polygon && pointInPolygon(p, r.polygon)) return r;
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || mode === "pan" || spaceDown.current) {
      panning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panning.current) {
      setOffset({
        x: panStart.current.ox + (e.clientX - panStart.current.x),
        y: panStart.current.oy + (e.clientY - panStart.current.y),
      });
      setHoverRoomId(null);
      setHoverPos(null);
      return;
    }
    const vp = viewportRef.current;
    const p = toNorm(e.clientX, e.clientY);
    if (!p || mode === "draw" || mode === "pan") {
      setHoverRoomId(null);
      setHoverPos(null);
      return;
    }
    const room = findRoomAt(p);
    setHoverRoomId(room?.id ?? null);
    if (room && vp) {
      const rect = vp.getBoundingClientRect();
      setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
      setHoverPos(null);
    }
  };

  const onPointerUp = () => {
    panning.current = false;
  };

  const onClick = (e: React.MouseEvent) => {
    if (mode === "pan" || spaceDown.current) return;
    const p = toNorm(e.clientX, e.clientY);
    if (!p) return;

    if (mode === "draw" && !showAssignPanel) {
      // Dvojklik blízko prvního bodu = dokončit tvar
      if (draft.length >= 3 && e.detail === 2) {
        const first = draft[0];
        const dist = Math.hypot(p.x - first.x, p.y - first.y);
        if (dist < 0.03) {
          finishShape();
          return;
        }
      }
      setDraft((d) => {
        const next = [...d, p];
        // Auto-nabídnout dokončení vizuálně přes toolbar; panel až po Dokončit
        return next;
      });
      return;
    }

    // Klik na neuložený draft polygon → otevřít panel přiřazení
    if (draft.length >= 3 && pointInPolygon(p, draft)) {
      setShowAssignPanel(true);
      return;
    }

    const room = findRoomAt(p);
    setSelectedRoomId(room?.id ?? null);
    if (room) {
      applyRoomToForm(room);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(4, Math.max(0.25, s * delta)));
  };

  const createPlan = async () => {
    if (!createFile) {
      setError("Vyberte PDF nebo obrázek půdorysu");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("name", createPlanForm.name || createPlanForm.floor_label);
      fd.append("floor_label", createPlanForm.floor_label);
      fd.append("building", createPlanForm.building);
      fd.append("file", createFile);
      const res = await fetch("/api/equipment/floor-plans", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba vytvoření");
      setShowCreatePlan(false);
      setCreateFile(null);
      setCreatePlanForm({ name: "", floor_label: "1NP", building: "" });
      setOkMsg("Půdorys nahrán.");
      await loadPlans();
      setPlanId(data.id);
      setImageBust(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  };

  const replaceImage = async (file: File | null) => {
    if (!file || !planId || !canAdmin) return;
    setSaving(true);
    setError("");
    setImageLoadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/equipment/floor-plans/${planId}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba nahrání");
      setOkMsg("Obrázek plánu aktualizován.");
      setImageBust(Date.now());
      await loadPlan(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  };

  const planImageSrc = planId
    ? `/api/equipment/floor-plans/${planId}/image?v=${imageBust || plan?.updated_at || planId}`
    : "";

  const saveNewRoom = async () => {
    if (!planId || draft.length < 3) return;
    const name = newRoomForm.name.trim();
    const code = newRoomForm.code.trim().toUpperCase();
    if (!name || !code) {
      setError("Vyplňte název a kód místnosti");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/equipment/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          floor: plan?.floor_label,
          building: plan?.building,
          floor_plan_id: planId,
          polygon: draft,
          plan_color: newRoomForm.color || defaultPlanColor(code),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba uložení místnosti");
      setDraft([]);
      setShowAssignPanel(false);
      setMode("view");
      setSelectedRoomId(data.id);
      setNewRoomForm({ name: "", code: "", color: "" });
      setOkMsg(`Místnost ${code} vytvořena na plánu.`);
      await loadPlan(planId);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  };

  const linkExistingRoom = async () => {
    if (!planId || draft.length < 3) return;
    const id = parseInt(linkRoomId, 10);
    if (!Number.isFinite(id)) {
      setError("Vyberte existující místnost");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/equipment/rooms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floor_plan_id: planId,
          polygon: draft,
          plan_color: newRoomForm.color || defaultPlanColor(id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba přiřazení");
      setDraft([]);
      setShowAssignPanel(false);
      setLinkRoomId("");
      setMode("view");
      setSelectedRoomId(id);
      applyRoomToForm({
        id: data.id ?? id,
        name: data.name ?? "",
        code: data.code ?? "",
        plan_color: data.plan_color,
      });
      setOkMsg(`Místnost ${data.code ?? id} přiřazena k polygonu.`);
      await loadPlan(planId);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedRoom = async () => {
    if (!selectedRoomId || !planId) return;
    const name = newRoomForm.name.trim();
    const code = newRoomForm.code.trim().toUpperCase();
    if (!name || !code) {
      setError("Název a kód místnosti nemohou být prázdné.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/equipment/rooms/${selectedRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          code,
          plan_color: newRoomForm.color || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba uložení");
      setOkMsg("Místnost upravena.");
      await loadPlan(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  };

  const replacePolygon = async () => {
    if (!selectedRoomId || !planId || draft.length < 3) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/equipment/rooms/${selectedRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floor_plan_id: planId,
          polygon: draft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Chyba polygonu");
      setDraft([]);
      setMode("view");
      setShowAssignPanel(false);
      setOkMsg("Tvar místnosti aktualizován.");
      await loadPlan(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  };

  const clearPolygon = async () => {
    if (!selectedRoomId || !planId) return;
    if (!confirm("Odebrat místnost z plánu (polygon)? Záznam místnosti zůstane.")) return;
    setSaving(true);
    try {
      await fetch(`/api/equipment/rooms/${selectedRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ polygon: null, floor_plan_id: null }),
      });
      setSelectedRoomId(null);
      await loadPlan(planId);
    } finally {
      setSaving(false);
    }
  };

  const transferToRoom = async (equipmentId: number, toRoomId: number) => {
    if (!canWrite) return;
    setError("");
    const res = await fetch("/api/equipment/placement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment_id: equipmentId,
        to_room_id: toRoomId,
        source: "manual",
        notes: "Přesun z půdorysu",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Přesun se nepovedl");
      return;
    }
    setOkMsg("Majetek přesunut.");
    if (selectedRoomId) {
      const r = await fetch(`/api/equipment/rooms/${selectedRoomId}`);
      const d = await r.json();
      setRoomItems(Array.isArray(d.items) ? d.items : []);
    }
    if (planId) await loadPlan(planId);
  };

  const onDropOnCanvas = async (e: React.DragEvent) => {
    e.preventDefault();
    const equipmentId = parseInt(e.dataTransfer.getData("text/equipment-id") || "", 10);
    setDraggingItemId(null);
    if (!Number.isFinite(equipmentId)) return;
    const p = toNorm(e.clientX, e.clientY);
    if (!p) return;
    const room = findRoomAt(p);
    if (!room) {
      setError("Přetáhněte majetek na místnost na plánu.");
      return;
    }
    await transferToRoom(equipmentId, room.id);
    setSelectedRoomId(room.id);
  };

  const polyToSvg = (poly: PlanPoint[]) =>
    poly.map((p) => `${p.x * imgNatural.w},${p.y * imgNatural.h}`).join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Map className="h-7 w-7 text-red-600" />
            Půdorys
          </h1>
          <p className="mt-1 text-gray-600">
            Interaktivní plán místností – kreslení, přiřazení a přesun majetku
          </p>
        </div>
        <Link href="/equipment/rooms" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
          Seznam místností
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {okMsg ? (
        <p className="text-sm text-green-700">
          {okMsg}{" "}
          <button type="button" className="underline" onClick={() => setOkMsg("")}>
            OK
          </button>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setPlanId(p.id);
              setSelectedRoomId(null);
              setDraft([]);
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              planId === p.id
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            {p.floor_label}
            <span className="ml-1 text-xs text-gray-500">({p._count?.rooms ?? 0})</span>
          </button>
        ))}
        {canAdmin ? (
          <button
            type="button"
            onClick={() => setShowCreatePlan(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
          >
            <Plus className="h-4 w-4" />
            Nahrát půdorys
          </button>
        ) : null}
      </div>

      {showCreatePlan && canAdmin ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
          <h2 className="font-semibold">Nový půdorys (PDF / PNG / JPG)</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className="rounded border px-3 py-2"
              placeholder="Název (např. Hlavní budova 1NP)"
              value={createPlanForm.name}
              onChange={(e) => setCreatePlanForm({ ...createPlanForm, name: e.target.value })}
            />
            <input
              className="rounded border px-3 py-2"
              placeholder="Patro (1NP / 2NP)"
              value={createPlanForm.floor_label}
              onChange={(e) => setCreatePlanForm({ ...createPlanForm, floor_label: e.target.value })}
            />
            <input
              className="rounded border px-3 py-2"
              placeholder="Budova"
              value={createPlanForm.building}
              onChange={(e) => setCreatePlanForm({ ...createPlanForm, building: e.target.value })}
            />
          </div>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            onChange={(e) => setCreateFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void createPlan()}
              className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Nahrávám…" : "Uložit půdorys"}
            </button>
            <button type="button" className="rounded-lg border px-4 py-2" onClick={() => setShowCreatePlan(false)}>
              Zrušit
            </button>
          </div>
        </div>
      ) : null}

      {!plan ? (
        <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
          {plans.length === 0
            ? "Zatím žádný půdorys. Nahrajte PDF 1NP / 2NP."
            : "Načítám plán…"}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border bg-white p-1">
                <button
                  type="button"
                  title="Výběr"
                  onClick={() => setMode("view")}
                  className={`rounded px-2 py-1 ${mode === "view" ? "bg-red-600 text-white" : "text-gray-700"}`}
                >
                  <MousePointer2 className="h-4 w-4" />
                </button>
                {canAdmin ? (
                  <button
                    type="button"
                    title="Kreslit místnost"
                    onClick={() => {
                      setMode("draw");
                      setDraft([]);
                      setShowAssignPanel(false);
                      setSelectedRoomId(null);
                    }}
                    className={`rounded px-2 py-1 ${mode === "draw" ? "bg-red-600 text-white" : "text-gray-700"}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Posun (nebo mezerník)"
                  onClick={() => setMode("pan")}
                  className={`rounded px-2 py-1 ${mode === "pan" ? "bg-red-600 text-white" : "text-gray-700"}`}
                >
                  <Hand className="h-4 w-4" />
                </button>
              </div>
              <button type="button" className="rounded border bg-white p-1.5" onClick={() => setScale((s) => Math.min(4, s * 1.2))}>
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" className="rounded border bg-white p-1.5" onClick={() => setScale((s) => Math.max(0.25, s / 1.2))}>
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded border bg-white px-2 py-1 text-xs"
                onClick={() => {
                  setScale(1);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                <Crosshair className="mr-1 inline h-3.5 w-3.5" />
                Reset
              </button>
              {canAdmin ? (
                <label className="inline-flex cursor-pointer items-center gap-1 rounded border bg-white px-2 py-1 text-xs hover:bg-gray-50">
                  <Upload className="h-3.5 w-3.5" />
                  Vyměnit obrázek
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => void replaceImage(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : null}
              {canAdmin && draft.length >= 3 && !showAssignPanel ? (
                <button
                  type="button"
                  onClick={() => finishShape()}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Dokončit tvar ({draft.length} bodů)
                </button>
              ) : null}
              {draft.length > 0 ? (
                <button
                  type="button"
                  onClick={cancelDraft}
                  className="rounded border bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Zrušit kreslení
                </button>
              ) : null}
              <span className="text-xs text-gray-500">
                {showAssignPanel
                  ? "Dokončete přiřazení v panelu vpravo: vytvořit novou nebo přiřadit existující."
                  : mode === "draw"
                    ? "Obkreslete místnost (≥3 body) → Dokončit → vytvořit nebo přiřadit existující. Enter / dvojklik na 1. bod také dokončí."
                    : "Klikněte na místnost. Majetek přetáhněte na jinou místnost. Neuložený polygon klikněte pro přiřazení."}
              </span>
            </div>

            <div
              ref={viewportRef}
              className="relative h-[min(70vh,720px)] overflow-hidden rounded-xl border bg-slate-100 shadow-sm"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={() => {
                setHoverRoomId(null);
                setHoverPos(null);
              }}
              onClick={onClick}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void onDropOnCanvas(e)}
              style={{ cursor: mode === "pan" || spaceDown.current ? "grab" : mode === "draw" ? "crosshair" : "default" }}
            >
              <div
                className="origin-top-left"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  width: imgNatural.w,
                  height: imgNatural.h,
                }}
              >
                {imageLoadError ? (
                  <div className="flex h-full min-h-[240px] items-center justify-center bg-white p-6 text-center text-sm text-red-700">
                    {imageLoadError}
                  </div>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  key={planImageSrc}
                  src={planImageSrc}
                  alt={plan.name}
                  className={`pointer-events-none select-none ${imageLoadError ? "hidden" : ""}`}
                  style={{ width: imgNatural.w, height: imgNatural.h }}
                  onLoad={(e) => {
                    setImageLoadError("");
                    const img = e.currentTarget;
                    if (
                      planId &&
                      (!plan.image_width || !plan.image_height) &&
                      img.naturalWidth
                    ) {
                      void fetch(`/api/equipment/floor-plans/${planId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          image_width: img.naturalWidth,
                          image_height: img.naturalHeight,
                        }),
                      }).then(() => loadPlan(planId));
                    }
                  }}
                  onError={() => {
                    setImageLoadError(
                      "Obrázek půdorysu se nepodařilo načíst (soubor na serveru chybí nebo není dostupný). Použijte „Vyměnit obrázek“ a nahrajte PDF/PNG/JPG znovu."
                    );
                  }}
                  draggable={false}
                />
                <svg
                  className="absolute left-0 top-0"
                  width={imgNatural.w}
                  height={imgNatural.h}
                  viewBox={`0 0 ${imgNatural.w} ${imgNatural.h}`}
                >
                  {plan.rooms.map((r) => {
                    if (!r.polygon) return null;
                    const color = r.plan_color || defaultPlanColor(r.id);
                    const active = r.id === selectedRoomId || r.id === hoverRoomId;
                    const dropTarget = draggingItemId != null && r.id === hoverRoomId;
                    const c = centroidOfPolygon(r.polygon);
                    return (
                      <g key={r.id}>
                        <polygon
                          points={polyToSvg(r.polygon)}
                          fill={color}
                          fillOpacity={dropTarget ? 0.55 : active ? 0.4 : 0.22}
                          stroke={color}
                          strokeWidth={active ? 3 / scale : 1.5 / scale}
                        />
                        <text
                          x={c.x * imgNatural.w}
                          y={c.y * imgNatural.h}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="pointer-events-none select-none"
                          fill="#111"
                          fontSize={12 / scale}
                          fontWeight={600}
                        >
                          {r.code}
                          {r._count?.equipment_items
                            ? ` (${r._count.equipment_items})`
                            : ""}
                        </text>
                      </g>
                    );
                  })}
                  {draft.length > 0 ? (
                    <g>
                      <polyline
                        points={polyToSvg(draft)}
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth={2 / scale}
                        strokeDasharray={`${6 / scale} ${4 / scale}`}
                      />
                      {draft.length >= 3 ? (
                        <polygon
                          points={polyToSvg(draft)}
                          fill="#dc2626"
                          fillOpacity={0.15}
                          stroke="#dc2626"
                          strokeWidth={2 / scale}
                        />
                      ) : null}
                      {draft.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x * imgNatural.w}
                          cy={p.y * imgNatural.h}
                          r={4 / scale}
                          fill="#dc2626"
                        />
                      ))}
                    </g>
                  ) : null}
                </svg>
              </div>
              {hoverRoom && hoverPos && mode === "view" && draggingItemId == null ? (
                <div
                  className="pointer-events-none absolute z-20 w-64 max-w-[calc(100%-16px)] rounded-lg border border-gray-200 bg-white/95 p-2.5 shadow-lg"
                  style={{
                    left: Math.min(hoverPos.x + 14, Math.max(8, (viewportRef.current?.clientWidth ?? 320) - 272)),
                    top: Math.min(hoverPos.y + 14, Math.max(8, (viewportRef.current?.clientHeight ?? 240) - 180)),
                  }}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {hoverRoom.code} – {hoverRoom.name}
                  </p>
                  <p className="mb-1.5 text-xs text-gray-500">
                    Majetek: {hoverRoom._count?.equipment_items ?? hoverItems.length}
                  </p>
                  {hoverItems.length === 0 ? (
                    <p className="text-xs text-gray-500">Žádný majetek v místnosti.</p>
                  ) : (
                    <ul className="max-h-44 space-y-1 overflow-y-auto text-xs">
                      {hoverItems.slice(0, 12).map((it) => (
                        <li key={it.id} className="border-t border-gray-100 pt-1">
                          <span className="font-medium text-gray-900">{it.name}</span>
                          <span className="block text-gray-500">
                            {it.asset_tag ?? "—"}
                            {it.equipment_categories?.name ? ` · ${it.equipment_categories.name}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {hoverItems.length > 12 ? (
                    <p className="mt-1 text-[11px] text-gray-500">
                      a dalších {hoverItems.length - 12}…
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-3">
            {showAssignPanel && draft.length >= 3 && canAdmin ? (
              <div className="rounded-xl border border-red-200 bg-white p-4 shadow-sm space-y-3">
                <h2 className="font-semibold">
                  {selectedRoomId && assignTab === "create" && mode === "draw"
                    ? "Nahradit tvar místnosti"
                    : "Přiřadit obkreslenou oblast"}
                </h2>
                <p className="text-xs text-gray-500">Bodů polygonu: {draft.length}</p>

                {selectedRoomId && selectedRoom ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void replacePolygon()}
                    className="w-full rounded-lg bg-red-600 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Uložit jako nový tvar „{selectedRoom.code}“
                  </button>
                ) : null}

                <div className="flex rounded-lg border p-0.5 text-sm">
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-2 py-1.5 ${
                      assignTab === "create" ? "bg-red-600 text-white" : "text-gray-700"
                    }`}
                    onClick={() => setAssignTab("create")}
                  >
                    Vytvořit novou
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-2 py-1.5 ${
                      assignTab === "link" ? "bg-red-600 text-white" : "text-gray-700"
                    }`}
                    onClick={() => setAssignTab("link")}
                  >
                    Přiřadit existující
                  </button>
                </div>

                {assignTab === "create" ? (
                  <div className="space-y-2">
                    <input
                      className="w-full rounded border px-2 py-1.5 text-sm"
                      placeholder="Název"
                      value={newRoomForm.name}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, name: e.target.value })}
                    />
                    <input
                      className="w-full rounded border px-2 py-1.5 font-mono text-sm uppercase"
                      placeholder="Kód (např. V-ADM)"
                      value={newRoomForm.code}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, code: e.target.value })}
                    />
                    <label className="block text-xs text-gray-500">
                      Barva na plánu
                      <input
                        type="color"
                        className="mt-1 h-9 w-full cursor-pointer rounded border"
                        value={newRoomForm.color || "#ef4444"}
                        onChange={(e) => setNewRoomForm({ ...newRoomForm, color: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveNewRoom()}
                      className="w-full rounded-lg bg-red-600 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Vytvořit místnost
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      className="w-full rounded border px-2 py-1.5 text-sm"
                      value={linkRoomId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setLinkRoomId(nextId);
                        const room = linkableRooms.find((r) => String(r.id) === nextId);
                        if (room) applyRoomToForm(room);
                      }}
                    >
                      <option value="">— Vyberte místnost —</option>
                      {linkableRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} – {r.name}
                        </option>
                      ))}
                    </select>
                    {linkRoomPreview ? (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-sm">
                        <p className="font-medium text-green-900">
                          {linkRoomPreview.code} – {linkRoomPreview.name}
                        </p>
                        <p className="mt-1 text-xs text-green-800">
                          Název a kód zůstanou beze změny. Uloží se jen polygon na plánu.
                        </p>
                      </div>
                    ) : null}
                    {linkableRooms.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        Žádná místnost bez polygonu. Nejdřív ji vytvořte v seznamu místností, nebo použijte
                        „Vytvořit novou“.
                      </p>
                    ) : null}
                    <label className="block text-xs text-gray-500">
                      Barva na plánu
                      <input
                        type="color"
                        className="mt-1 h-9 w-full cursor-pointer rounded border"
                        value={newRoomForm.color || "#ef4444"}
                        onChange={(e) => setNewRoomForm({ ...newRoomForm, color: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={saving || !linkRoomId}
                      onClick={() => void linkExistingRoom()}
                      className="w-full rounded-lg bg-red-600 py-2 text-sm text-white disabled:opacity-50"
                    >
                      Přiřadit k polygonu
                    </button>
                  </div>
                )}

                <button type="button" className="w-full rounded border py-1.5 text-sm" onClick={cancelDraft}>
                  Zrušit
                </button>
              </div>
            ) : null}

            {selectedRoom && !(showAssignPanel && draft.length >= 3) ? (
              <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{selectedRoom.name}</h2>
                    <p className="font-mono text-sm text-gray-600">{selectedRoom.code}</p>
                  </div>
                  <Link
                    href={`/equipment/rooms/${selectedRoom.id}`}
                    className="text-xs text-red-700 hover:underline"
                  >
                    Detail
                  </Link>
                </div>

                {canAdmin ? (
                  <div className="space-y-2 border-t pt-2">
                    <input
                      className="w-full rounded border px-2 py-1.5 text-sm"
                      value={newRoomForm.name}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, name: e.target.value })}
                    />
                    <input
                      className="w-full rounded border px-2 py-1.5 font-mono text-sm"
                      value={newRoomForm.code}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, code: e.target.value })}
                    />
                    <input
                      type="color"
                      className="h-8 w-full cursor-pointer rounded border"
                      value={newRoomForm.color || defaultPlanColor(selectedRoom.id)}
                      onChange={(e) => setNewRoomForm({ ...newRoomForm, color: e.target.value })}
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void updateSelectedRoom()}
                      className="w-full rounded bg-gray-800 py-1.5 text-sm text-white"
                    >
                      Uložit údaje
                    </button>
                    <button
                      type="button"
                      className="w-full rounded border py-1.5 text-sm"
                      onClick={() => {
                        setMode("draw");
                        setDraft(selectedRoom.polygon ?? []);
                        setShowAssignPanel(false);
                      }}
                    >
                      Překreslit tvar
                    </button>
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-1 rounded border border-red-200 py-1.5 text-sm text-red-700"
                      onClick={() => void clearPolygon()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Odebrat z plánu
                    </button>
                  </div>
                ) : null}

                <div className="border-t pt-2">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">
                    Majetek ({roomItems.length})
                  </h3>
                  {roomItems.length === 0 ? (
                    <p className="text-xs text-gray-500">Prázdná místnost.</p>
                  ) : (
                    <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                      {roomItems.map((it) => (
                        <li
                          key={it.id}
                          draggable={canWrite}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/equipment-id", String(it.id));
                            setDraggingItemId(it.id);
                          }}
                          onDragEnd={() => setDraggingItemId(null)}
                          className={`rounded border px-2 py-1.5 ${
                            canWrite ? "cursor-grab active:cursor-grabbing hover:bg-gray-50" : ""
                          }`}
                        >
                          <Link href={`/equipment/${it.id}`} className="font-medium text-red-700 hover:underline">
                            {it.name}
                          </Link>
                          <p className="text-xs text-gray-500">
                            {it.asset_tag ?? "—"} · {it.status ?? "—"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canWrite ? (
                    <p className="mt-2 text-xs text-gray-500">
                      Přetáhněte položku na jinou místnost na plánu.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-4 text-sm text-gray-600 shadow-sm">
                <p className="font-medium text-gray-900">{plan.name}</p>
                <p className="mt-1">
                  {plan.floor_label}
                  {plan.building ? ` · ${plan.building}` : ""}
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  Klikněte na vybarvenou místnost pro detail a majetek.
                  {canAdmin ? " Tužkou nakreslíte novou místnost." : ""}
                </p>
                <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto text-xs">
                  {plan.rooms
                    .filter((r) => r.polygon)
                    .map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="text-left text-red-700 hover:underline"
                          onClick={() => setSelectedRoomId(r.id)}
                        >
                          {r.code} – {r.name}
                          {r._count?.equipment_items != null
                            ? ` (${r._count.equipment_items})`
                            : ""}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
