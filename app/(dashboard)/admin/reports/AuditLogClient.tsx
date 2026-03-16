"use client";

import { useState, useEffect } from "react";

type LogEntry = {
  id: number;
  module: string;
  action: string;
  table_name: string | null;
  record_id: number | null;
  created_at: string;
  users: { first_name: string; last_name: string } | null;
};

type Props = {
  modules: string[];
};

export function AuditLogClient({ modules }: Props) {
  const [module, setModule] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (module) params.set("module", module);
    params.set("limit", "100");
    fetch(`/api/admin/audit?${params}`)
      .then((r) => r.json())
      .then((data) => setLogs(data.logs ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [module]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("cs-CZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <select
          value={module}
          onChange={(e) => setModule(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="">Všechny moduly</option>
          {modules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Načítání…</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Datum</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Modul</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Akce</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tabulka</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Uživatel</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Žádné záznamy
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">{log.module}</td>
                    <td className="px-4 py-3">{log.action}</td>
                    <td className="px-4 py-3 text-gray-600">{log.table_name ?? "-"}</td>
                    <td className="px-4 py-3">
                      {log.record_id != null ? log.record_id : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {log.users
                        ? `${log.users.first_name} ${log.users.last_name}`
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
