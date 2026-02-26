import { useState, useEffect, useCallback } from 'react';
import type { GenerationRun } from '../lib/types';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Succeeded', value: 'succeeded' },
  { label: 'Failed', value: 'failed' },
  { label: 'Running', value: 'running' },
] as const;

const STATUS_STYLES: Record<string, string> = {
  succeeded: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20',
  failed: 'bg-red-500/15 text-red-400 ring-red-500/20',
  running: 'bg-amber-500/15 text-amber-400 ring-amber-500/20',
};

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso + 'Z');
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function LogsTable() {
  const [logs, setLogs] = useState<GenerationRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      {/* Status tabs */}
      <div className="mb-6 flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              status === tab.value
                ? 'bg-neutral-800 text-neutral-100 ring-1 ring-neutral-700'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-800/60 bg-neutral-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800/60 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Weather</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Image</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-neutral-800/30">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-16 animate-pulse rounded bg-neutral-800" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                  No logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.run_id}
                  className="border-b border-neutral-800/30 transition-colors hover:bg-neutral-800/20 cursor-pointer"
                  onClick={() => setExpanded(expanded === log.run_id ? null : log.run_id)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-400">
                    {formatTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {log.resolved_city_name || log.city}
                  </td>
                  <td className="px-4 py-3">
                    {log.weather_icon && <span className="mr-1">{log.weather_icon}</span>}
                    <span className="text-neutral-400">{log.weather_condition || '—'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-400">
                    {log.temp_min != null ? `${log.temp_min}° / ${log.temp_max}°` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[log.status] || ''}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-400 tabular-nums">
                    {formatDuration(log.duration_ms)}
                  </td>
                  <td className="px-4 py-3">
                    {log.image_r2_key ? (
                      <img
                        src={`/api/images/${encodeURIComponent(log.image_r2_key)}`}
                        alt=""
                        className="h-10 w-7 rounded object-cover ring-1 ring-neutral-700"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Expanded error row */}
        {expanded && (() => {
          const log = logs.find((l) => l.run_id === expanded);
          if (!log?.error_message) return null;
          return (
            <div className="border-t border-red-900/30 bg-red-950/20 px-4 py-3 text-sm">
              <span className="font-medium text-red-400">Error: </span>
              <span className="text-red-300/80">{log.error_message}</span>
            </div>
          );
        })()}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
          <span>{total} records</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg px-3 py-1.5 transition-colors hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="flex items-center px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg px-3 py-1.5 transition-colors hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
