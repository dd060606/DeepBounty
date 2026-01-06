import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Module, TaskTemplate } from "@deepbounty/sdk/types";
import ApiClient from "@/utils/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import type { Column, ColumnDef } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { ArrowUpDown, ListFilter, Play, Trash2 } from "lucide-react";

function IntervalEditor({
  template,
  disabled,
  onCommit,
}: {
  template: Pick<TaskTemplate, "id" | "interval" | "schedulingType">;
  disabled: boolean;
  onCommit: (interval: number) => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState<string>(String(template.interval));

  useEffect(() => {
    setValue(String(template.interval));
  }, [template.interval]);

  const validate = useCallback(
    (raw: string) => {
      const parsed = Number.parseInt(raw.trim(), 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        toast.error(t("modules.taskTemplates.errors.interval"));
        return undefined;
      }
      return parsed;
    },
    [t]
  );

  const commit = useCallback(() => {
    const parsed = validate(value);
    if (parsed === undefined) {
      setValue(String(template.interval));
      return;
    }
    if (parsed === template.interval) {
      return;
    }
    onCommit(parsed);
  }, [onCommit, template.interval, validate, value]);

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Input
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onBlur={commit}
        className="w-28"
        inputMode="numeric"
      />
      <span className="text-muted-foreground text-xs">{t("tasks.seconds")}</span>
    </div>
  );
}

type Props = {
  templates: TaskTemplate[];
  modules: Module[];
  onTemplateUpdated: (template: TaskTemplate) => void;
  onTemplateDeleted: (templateId: number) => void;
};

function TableHeader<TData>({ column, title }: { column: Column<TData>; title: string }) {
  return (
    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      {title}
      <ArrowUpDown className="size-4" />
    </Button>
  );
}

function moduleNameById(modules: Module[]) {
  const map = new Map<string, string>();
  for (const m of modules) map.set(m.id, m.name || m.id);
  return map;
}

export default function TaskTemplatesSection({
  templates,
  modules,
  onTemplateUpdated,
  onTemplateDeleted,
}: Props) {
  const { t } = useTranslation();

  const [showNonRunnable, setShowNonRunnable] = useState(false);

  const moduleNames = useMemo(() => moduleNameById(modules), [modules]);

  const moduleOptions = useMemo(() => {
    const seen = new Set<string>();
    // Prefer showing modules that exist (loaded), but also include orphan moduleIds from templates.
    for (const m of modules) seen.add(m.id);
    for (const tpl of templates) seen.add(tpl.moduleId);

    return Array.from(seen)
      .map((moduleId) => ({ moduleId, name: moduleNames.get(moduleId) || moduleId }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [modules, templates, moduleNames]);

  const [moduleFilter, setModuleFilter] = useState<Record<string, boolean>>(() => ({}));

  // Initialize filter defaults (all true) when options change.
  useEffect(() => {
    setModuleFilter((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const opt of moduleOptions) {
        if (next[opt.moduleId] === undefined) next[opt.moduleId] = true;
      }
      for (const key of Object.keys(next)) {
        if (!moduleOptions.some((o) => o.moduleId === key)) delete next[key];
      }
      return next;
    });
  }, [moduleOptions]);

  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; template?: TaskTemplate }>({
    open: false,
  });

  const filteredTemplates = useMemo(() => {
    if (!templates?.length) return [];
    return (
      templates
        // Filter by module
        .filter((tpl) => moduleFilter[tpl.moduleId] ?? true)
        // Filter non-runnable if needed
        .filter((tpl) => {
          if (showNonRunnable) return true;
          return !(tpl.schedulingType === "CUSTOM" && tpl.interval <= 0);
        })
        .sort((a, b) => {
          const an = a.name.localeCompare(b.name);
          if (an !== 0) return an;
          return a.id - b.id;
        })
    );
  }, [templates, moduleFilter, showNonRunnable]);

  const patchTemplate = useCallback(
    async (id: number, patch: { active?: boolean; interval?: number }) => {
      setBusy((s) => new Set(s).add(id));
      try {
        await ApiClient.patch(`/tasks/templates/${id}`, patch);
        const old = templates.find((tt) => tt.id === id);
        if (old) onTemplateUpdated({ ...old, ...patch } as TaskTemplate);
        toast.success(t("modules.taskTemplates.success.updated"));
      } catch {
        toast.error(t("modules.taskTemplates.errors.update"));
      } finally {
        setBusy((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }
    },
    [templates, onTemplateUpdated, t]
  );

  const commitInterval = useCallback(
    (tpl: TaskTemplate, interval: number) => {
      patchTemplate(tpl.id, { interval });
    },
    // Depends on patchTemplate function identity in current render.
    [patchTemplate]
  );

  async function runTemplate(id: number) {
    setBusy((s) => new Set(s).add(id));
    try {
      await ApiClient.post(`/tasks/templates/${id}/run`);
      toast.success(t("modules.taskTemplates.success.run"));
    } catch {
      toast.error(t("modules.taskTemplates.errors.run"));
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  }

  async function deleteTemplate(tpl: TaskTemplate) {
    setBusy((s) => new Set(s).add(tpl.id));
    try {
      await ApiClient.delete(`/tasks/templates/${tpl.id}`);
      onTemplateDeleted(tpl.id);
      toast.success(t("modules.taskTemplates.success.deleted"));
    } catch {
      toast.error(t("modules.taskTemplates.errors.delete"));
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(tpl.id);
        return next;
      });
    }
  }

  const columns: ColumnDef<TaskTemplate>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <TableHeader column={column} title={t("common.name")} />,
    },
    {
      id: "module",
      accessorFn: (row) => moduleNames.get(row.moduleId) || row.moduleId,
      header: ({ column }) => <TableHeader column={column} title={t("modules.name")} />,
      cell: ({ row }) => {
        const tpl = row.original;
        return (
          <div className="flex flex-col">
            <div className="font-medium">{moduleNames.get(tpl.moduleId) || tpl.moduleId}</div>
            <div className="text-muted-foreground text-xs">{tpl.moduleId}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "schedulingType",
      header: ({ column }) => (
        <TableHeader column={column} title={t("modules.taskTemplates.scheduling")} />
      ),
      cell: ({ row }) => {
        const v = row.original.schedulingType;
        return <Badge variant="secondary">{v}</Badge>;
      },
    },
    {
      id: "interval",
      header: ({ column }) => <TableHeader column={column} title={t("tasks.interval")} />,
      cell: ({ row }) => {
        const tpl = row.original;
        const isBusy = busy.has(tpl.id);
        // If CUSTOM scheduling with interval 0, disable editing.
        const fixedInterval = tpl.schedulingType === "CUSTOM" && tpl.interval <= 0;

        return (
          <IntervalEditor
            template={tpl}
            disabled={isBusy || fixedInterval}
            onCommit={(interval) => commitInterval(tpl, interval)}
          />
        );
      },
    },
    {
      id: "active",
      header: () => <span>{t("modules.taskTemplates.active")}</span>,
      cell: ({ row }) => {
        const tpl = row.original;
        const isBusy = busy.has(tpl.id);
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={tpl.active}
              disabled={isBusy}
              onCheckedChange={(checked) => patchTemplate(tpl.id, { active: Boolean(checked) })}
            />
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span>{t("common.actions")}</span>,
      cell: ({ row }) => {
        const tpl = row.original;
        const isBusy = busy.has(tpl.id);
        return (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => runTemplate(tpl.id)}
              className="flex items-center gap-2"
            >
              <Play className="size-4" />
              {t("modules.taskTemplates.run")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isBusy}
              onClick={() => setDeleteConfirm({ open: true, template: tpl })}
              className="flex items-center gap-2"
            >
              <Trash2 className="size-4" />
              {t("common.delete")}
            </Button>
          </div>
        );
      },
    },
  ];

  const enabledCount = useMemo(() => {
    return filteredTemplates.filter((t) => t.active).length;
  }, [filteredTemplates]);

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-foreground text-lg font-semibold">
            {t("modules.taskTemplates.title")}
          </h2>
          <p className="text-muted-foreground text-xs">
            {t("modules.taskTemplates.subtitle", {
              total: filteredTemplates.length,
              enabled: enabledCount,
            })}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={showNonRunnable} onCheckedChange={(v) => setShowNonRunnable(v)} />
            <span className="text-muted-foreground text-xs">
              {t("modules.taskTemplates.showNonRunnable")}
            </span>
          </div>

          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <ListFilter className="size-4" />
                {t("modules.taskTemplates.filter")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("modules.taskTemplates.filterByModule")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {moduleOptions.map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt.moduleId}
                  checked={moduleFilter[opt.moduleId] ?? true}
                  onCheckedChange={(v) =>
                    setModuleFilter((s) => ({ ...s, [opt.moduleId]: Boolean(v) }))
                  }
                >
                  {opt.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Task templates */}
      {filteredTemplates.length === 0 ? (
        <div className="text-muted-foreground border-border bg-card/60 rounded-xl border p-8 text-center">
          <p className="text-sm font-medium">{t("modules.taskTemplates.empty.title")}</p>
          <p className="text-xs">{t("modules.taskTemplates.empty.hint")}</p>
        </div>
      ) : (
        <DataTable columns={columns} data={filteredTemplates} getRowId={(row) => String(row.id)} />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm({ open: false });
        }}
        onConfirm={async () => {
          const tpl = deleteConfirm.template;
          if (!tpl) return;
          await deleteTemplate(tpl);
          setDeleteConfirm({ open: false });
        }}
        onCancel={() => setDeleteConfirm({ open: false })}
        title={t("modules.taskTemplates.deleteConfirm.title")}
        desc={t("modules.taskTemplates.deleteConfirm.description")}
        confirmText={t("common.delete")}
      />
    </div>
  );
}
