import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ApiClient from "@/utils/api";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";

interface EventSeriesPoint {
  windowEnd: string;
  count: number;
  avgHandlerMs: number;
  maxHandlerMs: number;
}

interface EventStat {
  eventType: string;
  totalCount: number;
  avgHandlerMs: number | null;
  maxHandlerMs: number | null;
  errors: number;
  series: EventSeriesPoint[];
}

// Stable color palette for the per-type lines
const PALETTE = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#84cc16",
];

function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function EventsTab({ days }: { days: number }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<EventStat[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    ApiClient.get<EventStat[]>("/metrics/events", { params: { days } })
      .then((res) => {
        if (!cancelled) setStats(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setStats([]);
          toast.error(t("analytics.errors.loadEvents"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days, t]);

  // Merge per-type series into a single time-indexed dataset for a multi-line chart
  const { chartData, types } = useMemo(() => {
    const byWindow = new Map<string, Record<string, number | string>>();
    const typeList = (stats ?? []).map((s) => s.eventType);
    for (const s of stats ?? []) {
      for (const p of s.series) {
        const key = p.windowEnd;
        let row = byWindow.get(key);
        if (!row) {
          row = { windowEnd: new Date(key).toLocaleTimeString() };
          byWindow.set(key, row);
        }
        row[s.eventType] = p.count;
      }
    }
    const data = Array.from(byWindow.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, row]) => row);
    return { chartData: data, types: typeList };
  }, [stats]);

  const columns = useMemo<ColumnDef<EventStat>[]>(
    () => [
      {
        accessorKey: "eventType",
        header: t("analytics.events.type"),
        cell: ({ row }) => <span className="font-medium">{row.original.eventType}</span>,
      },
      {
        accessorKey: "totalCount",
        header: t("analytics.events.total"),
        cell: ({ row }) => row.original.totalCount.toLocaleString(),
      },
      {
        accessorKey: "avgHandlerMs",
        header: t("analytics.events.avgHandler"),
        cell: ({ row }) => fmtMs(row.original.avgHandlerMs),
      },
      {
        accessorKey: "maxHandlerMs",
        header: t("analytics.events.maxHandler"),
        cell: ({ row }) => fmtMs(row.original.maxHandlerMs),
      },
      {
        accessorKey: "errors",
        header: t("analytics.events.errors"),
        cell: ({ row }) => (
          <span className={row.original.errors > 0 ? "text-destructive" : undefined}>
            {row.original.errors}
          </span>
        ),
      },
    ],
    [t]
  );

  if (stats === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed p-10 text-center">
        <p className="text-foreground font-medium">{t("analytics.events.empty.title")}</p>
        <p className="text-muted-foreground text-sm">{t("analytics.events.empty.hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-border rounded-lg border p-4">
        <h2 className="text-foreground font-semibold">{t("analytics.events.throughputTitle")}</h2>
        <p className="text-muted-foreground mb-4 text-sm">{t("analytics.events.throughputHint")}</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="windowEnd" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
            />
            <Legend />
            {types.map((type, i) => (
              <Line
                key={type}
                type="monotone"
                dataKey={type}
                stroke={PALETTE[i % PALETTE.length]}
                dot={false}
                strokeWidth={2}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="border-border rounded-lg border p-4">
        <h2 className="text-foreground font-semibold">{t("analytics.events.handlerTitle")}</h2>
        <p className="text-muted-foreground mb-4 text-sm">{t("analytics.events.handlerHint")}</p>
        <DataTable columns={columns} data={stats} />
      </div>
    </div>
  );
}
