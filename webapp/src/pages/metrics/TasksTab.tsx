import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ApiClient from "@/utils/api";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskTimingStat {
  templateId: number | null;
  name: string | null;
  moduleId: string | null;
  runs: number;
  successes: number;
  failures: number;
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  p95Ms: number | null;
  avgQueueMs: number | null;
}

// Format a millisecond value into a compact human string
function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export default function TasksTab({ days }: { days: number }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<TaskTimingStat[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    ApiClient.get<TaskTimingStat[]>("/metrics/tasks", { params: { days } })
      .then((res) => {
        if (!cancelled) setStats(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setStats([]);
          toast.error(t("analytics.errors.loadTasks"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [days, t]);

  const chartData = useMemo(
    () =>
      (stats ?? [])
        .filter((s) => s.avgMs !== null)
        .slice(0, 15)
        .map((s) => ({
          name: s.name ?? t("analytics.tasks.noTemplate"),
          avgMs: s.avgMs ?? 0,
        })),
    [stats, t]
  );

  const columns = useMemo<ColumnDef<TaskTimingStat>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("analytics.tasks.template"),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.name ?? t("analytics.tasks.noTemplate")}
          </span>
        ),
      },
      {
        accessorKey: "moduleId",
        header: t("analytics.tasks.module"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.moduleId ?? "—"}</span>
        ),
      },
      {
        accessorKey: "runs",
        header: t("analytics.tasks.runs"),
      },
      {
        id: "successRate",
        header: t("analytics.tasks.successRate"),
        cell: ({ row }) => {
          const { runs, successes } = row.original;
          if (!runs) return "—";
          return `${Math.round((successes / runs) * 100)}%`;
        },
      },
      {
        accessorKey: "avgMs",
        header: t("analytics.tasks.avg"),
        cell: ({ row }) => fmtMs(row.original.avgMs),
      },
      {
        accessorKey: "p95Ms",
        header: t("analytics.tasks.p95"),
        cell: ({ row }) => fmtMs(row.original.p95Ms),
      },
      {
        accessorKey: "maxMs",
        header: t("analytics.tasks.max"),
        cell: ({ row }) => fmtMs(row.original.maxMs),
      },
      {
        accessorKey: "avgQueueMs",
        header: t("analytics.tasks.avgQueue"),
        cell: ({ row }) => fmtMs(row.original.avgQueueMs),
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
        <p className="text-foreground font-medium">{t("analytics.tasks.empty.title")}</p>
        <p className="text-muted-foreground text-sm">{t("analytics.tasks.empty.hint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-border rounded-lg border p-4">
        <h2 className="text-foreground font-semibold">{t("analytics.tasks.chartTitle")}</h2>
        <p className="text-muted-foreground mb-4 text-sm">{t("analytics.tasks.chartHint")}</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={-20}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtMs(v as number)} />
            <Tooltip
              formatter={(v) => fmtMs(v as number)}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
              }}
            />
            <Bar dataKey="avgMs" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="border-border rounded-lg border p-4">
        <h2 className="text-foreground mb-4 font-semibold">{t("analytics.tasks.tableTitle")}</h2>
        <DataTable columns={columns} data={stats} />
      </div>
    </div>
  );
}
