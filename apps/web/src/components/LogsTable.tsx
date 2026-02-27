import { Fragment, useState, useEffect, useCallback } from 'react';
import type { GenerationRun } from '../lib/types';

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Succeeded', value: 'succeeded' },
  { label: 'Failed', value: 'failed' },
  { label: 'Running', value: 'running' },
] as const;

const STATUS_STYLES: Record<string, string> = {
  succeeded: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
  running: 'bg-amber-50 text-amber-700 ring-amber-200',
};

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso + 'Z');
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
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
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      const res = await fetch(`/api/logs?${params}`);
      const data = (await res.json()) as { logs: GenerationRun[]; total: number };
      setLogs(data.logs);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, status, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImage(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="fade-in-up">
      {/* Status tabs + refresh */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatus(tab.value); setPage(1); }}
              className={`h-9 cursor-pointer rounded-lg px-3.5 text-sm font-medium transition-all duration-200 ${
                status === tab.value
                  ? 'bg-ink text-white shadow-sm'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-dim'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={loading}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink-muted transition-all hover:bg-surface-dim hover:text-ink disabled:opacity-30"
          title="刷新"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface-raised shadow-sm">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-32" />
            <col className="w-64" />
            <col className="w-40" />
            <col className="w-28" />
            <col className="w-[6.5rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-ink-faint">
              <th className="px-4 py-3 font-medium">Run ID</th>
              <th className="px-4 py-3 font-medium">Model</th>
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
                <tr key={i} className="border-b border-border-dim">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <div className="skeleton h-4 w-16 rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-ink-muted">
                  No logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <Fragment key={log.run_id}>
                  <tr
                    className="cursor-pointer border-b border-border-dim transition-colors duration-150 hover:bg-surface-dim/50"
                    onClick={() => setExpanded(expanded === log.run_id ? null : log.run_id)}
                  >
                    <td className="px-4 py-3 text-xs font-mono text-ink-faint">
                      <span className="block truncate" title={log.run_id}>
                        {log.run_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      <span className="block truncate" title={log.model ?? ''}>
                        {log.model || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted tabular-nums">
                      {formatTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      <span className="block truncate" title={log.resolved_city_name || log.city}>
                        {log.resolved_city_name || log.city}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {log.weather_icon && <span className="mr-1">{log.weather_icon}</span>}
                      {log.weather_condition || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted tabular-nums">
                      {log.temp_min != null ? `${log.temp_min}° / ${log.temp_max}°` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[log.status] || ''}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted tabular-nums">
                      {formatDuration(log.duration_ms)}
                    </td>
                    <td className="px-4 py-3">
                      {log.image_r2_key ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage({
                              src: `/api/images/${log.image_r2_key}`,
                              alt: `${log.resolved_city_name || log.city} weather card`,
                            });
                          }}
                          className="cursor-zoom-in"
                          title="点击放大"
                        >
                          <img
                            src={`/api/images/${log.image_r2_key}`}
                            alt=""
                            className="h-10 w-7 rounded-md object-cover ring-1 ring-border transition-all duration-200"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded === log.run_id && log.error_message && (
                    <tr>
                      <td colSpan={9} className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm">
                        <span className="font-medium text-red-700">Error: </span>
                        <span className="text-red-600">{log.error_message}</span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
        <div className="flex items-center gap-2">
          <span>{total} records</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-muted outline-none cursor-pointer"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="cursor-pointer rounded-lg px-3 py-1.5 transition-colors duration-150 hover:bg-surface-dim disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="flex items-center px-2 tabular-nums text-ink">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="cursor-pointer rounded-lg px-3 py-1.5 transition-colors duration-150 hover:bg-surface-dim disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/55 px-4 backdrop-blur-sm fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage.src}
            alt={lightboxImage.alt}
            className="max-h-[90vh] max-w-[94vw] rounded-2xl object-contain shadow-2xl cursor-zoom-out fade-in-up"
            onClick={() => setLightboxImage(null)}
          />
        </div>
      )}
    </div>
  );
}
