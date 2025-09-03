import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { faviconUrl, normalizeDomain } from "@/utils/domains";
import type { Alert } from "@/utils/types";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ListFilter } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import SeverityBadge from "./SeverityBadge";
import { Badge } from "@/components/ui/badge";

type Props = {
  alerts: Alert[];
  onRowClick?: (alert: Alert) => void;
};

export default function AlertsTable({ alerts, onRowClick }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const alertsColumns: ColumnDef<Alert>[] = [
    {
      accessorKey: "name",
      header: t("common.name"),
    },
    {
      accessorKey: "targetName",
      header: t("common.company"),
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-3">
            <img
              src={faviconUrl(row.original.targetName)}
              alt={`${row.original.targetName} favicon`}
              className="h-6 w-6 rounded-sm"
            />
            <div className="flex flex-col">
              <div className="font-medium">{row.original.targetName}</div>
              <div className="text-muted-foreground text-xs">{row.original.subdomain}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "score",
      header: t("alerts.score"),
      cell: ({ row }) => {
        return <SeverityBadge severity={row.original.score} />;
      },
    },
    {
      accessorKey: "confirmed",
      header: t("alerts.status"),
      cell: ({ row }) => {
        if (row.original.confirmed) {
          return <Badge>{t("alerts.confirmed")}</Badge>;
        }
        return <Badge variant="destructive">{t("alerts.unconfirmed")}</Badge>;
      },
    },
    {
      accessorKey: "createdAt",
      header: t("common.date"),
      cell: ({ row }) => {
        return (
          <div>
            {new Date(row.original.createdAt).toLocaleString(undefined, {
              year: "numeric",
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        );
      },
    },
  ];

  // Filter alerts based on search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? alerts.filter((a) => {
          return (
            a.name.toLowerCase().includes(q) ||
            a.targetName.toLowerCase().includes(q) ||
            normalizeDomain(a.targetName).includes(q)
          );
        })
      : alerts;
  }, [alerts, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("alerts.searchPlaceholder")}
          className="max-w-xl"
        />
        <div className="flex items-center gap-2">
          {/* Filter button */}
          <Button variant="outline" onClick={() => {}}>
            <ListFilter />
            {t("common.filter")}
          </Button>
        </div>
      </div>

      <DataTable columns={alertsColumns} data={filtered} />

      {filtered.length === 0 && (
        <div className="text-muted-foreground border-border bg-card/60 mx-auto max-w-2xl rounded-xl border p-8 text-center">
          <p className="text-sm font-medium">{t("alerts.empty.title")}</p>
          <p className="text-xs">{t("alerts.empty.hint")}</p>
        </div>
      )}
    </div>
  );
}
