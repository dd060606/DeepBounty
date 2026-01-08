import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { faviconUrl } from "@/utils/domains";
import type { Alert } from "@deepbounty/sdk/types";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { ArrowUpDown, ListFilter, MoreHorizontal, Trash2 } from "lucide-react";
import type { Column, ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import SeverityBadge from "./SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/utils/date";

type Props = {
  alerts: Alert[];
  onRowClick?: (alert: Alert) => void;
  onDelete?: (alertId: number) => void;
  onDeleteMultiple?: (alertIds: number[]) => void;
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
};

// A header component that allows sorting
function TableHeader({ column, title }: { column: Column<Alert>; title: string }) {
  return (
    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      {title}
      <ArrowUpDown className="size-4" />
    </Button>
  );
}

export default function AlertsTable({
  alerts,
  onRowClick,
  onDelete,
  onDeleteMultiple,
  pageIndex,
  pageCount,
  pageSize,
  onPageChange,
}: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  // Filters
  const [severityFilter, setSeverityFilter] = useState({
    critical: true,
    high: true,
    medium: true,
    low: true,
    informational: true,
  });
  const [statusFilter, setStatusFilter] = useState({
    confirmed: true,
    unconfirmed: true,
  });

  // Columns definition
  const alertsColumns: ColumnDef<Alert>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          className="size-5"
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          className="size-5"
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      cell: ({ row }) => `#${row.original.id}`,
      header: ({ column }) => {
        return <TableHeader column={column} title="ID" />;
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return <TableHeader column={column} title={t("common.name")} />;
      },
    },
    {
      accessorKey: "targetName",
      header: ({ column }) => {
        return <TableHeader column={column} title={t("common.company")} />;
      },
      cell: ({ row }) => {
        const hasTarget = row.original.targetName && row.original.domain;
        return (
          <div className="flex items-center gap-3">
            {hasTarget && (
              <img
                src={faviconUrl(row.original.domain)!}
                alt={`${row.original.targetName} favicon`}
                className="h-6 w-6 rounded-sm"
              />
            )}
            {/* empty placeholder to keep alignment */}
            {!hasTarget && <div className="h-6 w-6 rounded-sm" />}
            <div className="ml-sm flex flex-col">
              <div className="font-medium">{row.original.targetName || t("alerts.noTarget")}</div>
              <div className="text-muted-foreground text-xs">{row.original.subdomain}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "score",
      header: ({ column }) => {
        return <TableHeader column={column} title={t("alerts.score")} />;
      },
      cell: ({ row }) => {
        return <SeverityBadge score={row.original.score} />;
      },
    },
    {
      accessorKey: "confirmed",
      header: ({ column }) => {
        return <TableHeader column={column} title={t("alerts.status")} />;
      },
      cell: ({ row }) => {
        if (row.original.confirmed) {
          return <Badge>{t("alerts.confirmed")}</Badge>;
        }
        return <Badge variant="destructive">{t("alerts.unconfirmed")}</Badge>;
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return <TableHeader column={column} title={t("common.date")} />;
      },
      cell: ({ row }) => {
        return <div>{formatDate(row.original.createdAt)}</div>;
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const alert = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("common.actions")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(alert.id);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  // Filter alerts based on search query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? alerts.filter((a) => {
          return (
            a.name.toLowerCase().includes(q) ||
            a.targetName.toLowerCase().includes(q) ||
            a.subdomain.toLowerCase().includes(q) ||
            a.domain.toLowerCase().includes(q)
          );
        })
      : alerts;
    // Apply severity and status filters
    return base.filter((a) => {
      // Determine severity key
      const sevKey = (({ 1: "low", 2: "medium", 3: "high", 4: "critical" } as const)[a.score] ??
        "informational") as keyof typeof severityFilter;
      // Determine status key
      const statusKey = a.confirmed ? "confirmed" : "unconfirmed";
      return (severityFilter[sevKey] ?? true) && statusFilter[statusKey];
    });
  }, [alerts, query, severityFilter, statusFilter]);

  // Get selected alert IDs
  const selectedAlertIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key as keyof typeof rowSelection])
      .map((key) => filtered[Number.parseInt(key)]?.id)
      .filter((id): id is number => id !== undefined);
  }, [rowSelection, filtered]);

  useEffect(() => {
    setRowSelection({});
  }, [alerts]);

  const handleDeleteSelected = () => {
    if (selectedAlertIds.length > 0) {
      onDeleteMultiple?.(selectedAlertIds);
      setRowSelection({});
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("alerts.searchPlaceholder")}
          className="sm:max-w-xl"
        />
        <div className="flex gap-2">
          {selectedAlertIds.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              className="flex items-center gap-2"
            >
              <Trash2 className="size-4" />
              {t("alerts.deleteSelected")} ({selectedAlertIds.length})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex w-full items-center justify-center gap-2 sm:w-auto"
              >
                <ListFilter />
                {t("alerts.filter")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{t("alerts.filter")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger direction="left">
                  {t("alerts.score")}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuCheckboxItem
                      checked={severityFilter.critical}
                      onCheckedChange={(v) =>
                        setSeverityFilter((s) => ({ ...s, critical: Boolean(v) }))
                      }
                    >
                      {t("alerts.critical")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={severityFilter.high}
                      onCheckedChange={(v) =>
                        setSeverityFilter((s) => ({ ...s, high: Boolean(v) }))
                      }
                    >
                      {t("alerts.high")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={severityFilter.medium}
                      onCheckedChange={(v) =>
                        setSeverityFilter((s) => ({ ...s, medium: Boolean(v) }))
                      }
                    >
                      {t("alerts.medium")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={severityFilter.low}
                      onCheckedChange={(v) => setSeverityFilter((s) => ({ ...s, low: Boolean(v) }))}
                    >
                      {t("alerts.low")}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={severityFilter.informational}
                      onCheckedChange={(v) =>
                        setSeverityFilter((s) => ({ ...s, informational: Boolean(v) }))
                      }
                    >
                      {t("alerts.informational")}
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuCheckboxItem
                checked={statusFilter.confirmed}
                onCheckedChange={(v) => setStatusFilter((s) => ({ ...s, confirmed: Boolean(v) }))}
              >
                {t("alerts.confirmed")}
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilter.unconfirmed}
                onCheckedChange={(v) => setStatusFilter((s) => ({ ...s, unconfirmed: Boolean(v) }))}
              >
                {t("alerts.unconfirmed")}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filtered.length !== 0 ? (
        <DataTable
          columns={alertsColumns}
          data={filtered}
          onRowClick={onRowClick}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageCount={pageCount}
          onPageChange={onPageChange}
        />
      ) : (
        // Empty message
        <div className="text-muted-foreground border-border bg-card/60 mx-auto max-w-2xl rounded-xl border p-8 text-center">
          <p className="text-sm font-medium">{t("alerts.empty.title")}</p>
          <p className="text-xs">{t("alerts.empty.hint")}</p>
        </div>
      )}
    </div>
  );
}
