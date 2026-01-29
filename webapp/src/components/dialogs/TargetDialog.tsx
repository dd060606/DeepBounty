import { useMemo, useState, useEffect } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2Icon, Globe2, Play } from "lucide-react";
import {
  defaultWildcard,
  faviconUrl,
  normalizeDomain,
  isValidDomain,
  isValidSubdomainEntry,
} from "@/utils/domains";
import type { Target, TaskTemplate, TargetTaskOverride } from "@deepbounty/sdk/types";
import { Switch } from "@/components/ui/switch";
import ApiClient from "@/utils/api";
import { toast } from "sonner";

type TaskWithOverride = TaskTemplate & {
  overrideId?: number;
  overrideActive?: boolean;
  hasOverride: boolean;
};

type TargetDialogProps = {
  mode?: "create" | "edit";
  trigger?: React.ReactNode;
  initial?: Partial<Target>;
  allTasks?: TaskTemplate[];
  onSubmit?: (data: Partial<Target>) => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function TargetDialog({
  mode = "create",
  trigger,
  initial,
  allTasks = [],
  onSubmit,
  open: openProp,
  onOpenChange,
}: TargetDialogProps) {
  const { t } = useTranslation();
  const isControlled = typeof openProp === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? (openProp as boolean) : internalOpen;
  const [saving, setSaving] = useState(false);

  const [touched, setTouched] = useState<{
    name?: boolean;
    domain?: boolean;
    subs?: Record<number, boolean>;
    oos?: Record<number, boolean>;
  }>({});

  // Target data
  const [name, setName] = useState(initial?.name ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [activeScan, setActiveScan] = useState(initial?.activeScan ?? true);

  // In-Scope Subdomains
  const [subdomains, setSubdomains] = useState<string[]>(
    initial?.subdomains && initial.subdomains.length > 0
      ? initial.subdomains
      : initial?.domain
        ? [defaultWildcard(initial.domain)]
        : []
  );

  // Out-Of-Scope Subdomains
  const [oosSubdomains, setOosSubdomains] = useState<string[]>(
    initial?.outOfScopeSubdomains && initial.outOfScopeSubdomains.length > 0
      ? initial.outOfScopeSubdomains
      : [""]
  );

  // Advanced settings
  const [userAgent, setUserAgent] = useState<string>(initial?.settings?.userAgent ?? "");
  const [headerName, setHeaderName] = useState<string>(
    initial?.settings?.customHeader?.split(":")[0] ?? ""
  );
  const [headerValue, setHeaderValue] = useState<string>(
    initial?.settings?.customHeader?.split(":")[1] ?? ""
  );

  // Tasks state
  const [tasks, setTasks] = useState<TaskWithOverride[]>([]);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [busy, setBusy] = useState<Set<number>>(new Set());

  const icon = useMemo(() => faviconUrl(domain), [domain]);

  useEffect(() => {
    if (isOpen && mode === "edit" && initial?.id) {
      fetchTaskOverrides();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, initial?.id]);

  async function fetchTaskOverrides() {
    if (!initial?.id) return;
    setLoadingTasks(true);
    try {
      const res = await ApiClient.get<TargetTaskOverride[]>(
        `/tasks/targets/${initial.id}/task-overrides`
      );
      const overrides = res.data || [];

      const tasksWithOverrides: TaskWithOverride[] = allTasks.map((task) => {
        const override = overrides.find((o) => o.taskTemplateId === task.id);
        return {
          ...task,
          overrideId: override?.id,
          overrideActive: override?.active,
          hasOverride: !!override,
        };
      });

      setTasks(
        tasksWithOverrides.sort((a, b) => {
          const aRunnable =
            (a.schedulingType === "CUSTOM" && a.interval > 0) ||
            a.schedulingType === "TARGET_BASED";
          const bRunnable =
            (b.schedulingType === "CUSTOM" && b.interval > 0) ||
            b.schedulingType === "TARGET_BASED";

          if (aRunnable && !bRunnable) return -1;
          if (!aRunnable && bRunnable) return 1;
          return 0;
        })
      );
    } catch {
      toast.error(t("tasks.errors.loadTasks"));
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }

  const filteredTasks = useMemo(() => {
    const q = taskSearchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) => task.name.toLowerCase().includes(q));
  }, [tasks, taskSearchQuery]);

  function toggleTaskOverride(taskId: number) {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        if (task.hasOverride) {
          return { ...task, overrideActive: !task.overrideActive };
        }
        return { ...task, overrideActive: !task.active, hasOverride: true };
      })
    );
  }

  const nameError = !name.trim() ? t("targets.form.errors.nameRequired") : null;
  const domainRequired = !normalizeDomain(domain);
  const domainInvalid = !domainRequired && !isValidDomain(domain);
  const domainError = domainRequired
    ? t("targets.form.errors.domainRequired")
    : domainInvalid
      ? t("targets.form.errors.domainInvalid")
      : null;

  // Subdomain validation
  const subdomainErrors: Record<number, string> = {};
  subdomains.forEach((sd, idx) => {
    const v = sd.trim();
    if (v && !isValidSubdomainEntry(v)) {
      subdomainErrors[idx] = t("targets.form.errors.subdomainInvalid");
    }
  });

  // Out-of-scope validation
  const oosErrors: Record<number, string> = {};
  oosSubdomains.forEach((sd, idx) => {
    const v = sd.trim();
    if (v && !isValidSubdomainEntry(v)) {
      oosErrors[idx] = t("targets.form.errors.subdomainInvalid");
    }
  });

  const hasErrors = Boolean(
    nameError ||
      domainError ||
      Object.keys(subdomainErrors).length > 0 ||
      Object.keys(oosErrors).length > 0
  );

  // Row (subdomain and out of scope) handlers
  function handleAddRow(type: "sub" | "oos", index?: number) {
    const setFn = type === "sub" ? setSubdomains : setOosSubdomains;
    const current = type === "sub" ? subdomains : oosSubdomains;

    const next = [...current];
    const insertAt = typeof index === "number" ? index + 1 : next.length;
    next.splice(insertAt, 0, "");
    setFn(next);
  }

  function handleRemoveRow(type: "sub" | "oos", index: number) {
    const setFn = type === "sub" ? setSubdomains : setOosSubdomains;
    const current = type === "sub" ? subdomains : oosSubdomains;

    const next = current.filter((_, i) => i !== index);
    setFn(next.length ? next : [""]);
  }

  function handleChangeRow(type: "sub" | "oos", index: number, value: string) {
    const setFn = type === "sub" ? setSubdomains : setOosSubdomains;
    const current = type === "sub" ? subdomains : oosSubdomains;

    const next = [...current];
    next[index] = value;
    setFn(next);
  }

  // Submit handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    // Mark all as touched
    setTouched((s) => ({
      name: true,
      domain: true,
      subs: { ...(s.subs || {}), ...Object.fromEntries(subdomains.map((_, i) => [i, true])) },
      oos: { ...(s.oos || {}), ...Object.fromEntries(oosSubdomains.map((_, i) => [i, true])) },
    }));

    if (hasErrors) return;
    setSaving(true);

    const normalizedDomain = normalizeDomain(domain);
    let cleanedSubdomains = subdomains.map((s) => s.trim()).filter((s) => s.length > 0);
    const cleanedOos = oosSubdomains.map((s) => s.trim()).filter((s) => s.length > 0);

    // Default wildcard if empty
    if (cleanedSubdomains.length === 0) {
      const d = defaultWildcard(normalizedDomain || domain);
      if (d) cleanedSubdomains = [d];
    }

    try {
      await onSubmit?.({
        name: name.trim(),
        domain: normalizedDomain,
        subdomains: cleanedSubdomains,
        outOfScopeSubdomains: cleanedOos,
        activeScan,
        settings: {
          userAgent: userAgent.trim() || undefined,
          customHeader:
            headerName.trim() && headerValue.trim()
              ? `${headerName.trim()}: ${headerValue.trim()}`
              : undefined,
        },
      });

      if (mode === "edit" && initial?.id) {
        await saveTaskOverrides(initial.id);
      }
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  // Save task overrides
  async function saveTaskOverrides(targetId: number) {
    const overridesToSet: { templateId: number; active: boolean }[] = [];
    const overridesToRemove: number[] = [];

    tasks.forEach((task) => {
      if (task.hasOverride) {
        overridesToSet.push({ templateId: task.id, active: task.overrideActive! });
      } else if (task.overrideId) {
        overridesToRemove.push(task.id);
      }
    });

    try {
      if (overridesToSet.length > 0) {
        await ApiClient.put(`/tasks/targets/${targetId}/task-overrides`, overridesToSet);
      }
      if (overridesToRemove.length > 0) {
        await ApiClient.delete(`/tasks/targets/${targetId}/task-overrides`, {
          data: { templateIds: overridesToRemove },
        });
      }
    } catch {
      toast.error(t("tasks.errors.updateTask"));
    }
  }

  // Run template for a specific target
  async function runTemplateForTarget(templateId: number) {
    if (!initial?.id) return;
    setBusy((s) => new Set(s).add(templateId));
    try {
      await ApiClient.post(`/tasks/templates/${templateId}/run/${initial.id}/`);
      toast.success(t("modules.taskTemplates.success.run"));
    } catch {
      toast.error(t("modules.taskTemplates.errors.run"));
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(templateId);
        return next;
      });
    }
  }

  function initFromInitial() {
    setName(initial?.name ?? "");
    setDomain(initial?.domain ?? "");
    setActiveScan(initial?.activeScan ?? true);
    setUserAgent(initial?.settings?.userAgent ?? "");
    setHeaderName(initial?.settings?.customHeader?.split(":")[0] ?? "");
    setHeaderValue(initial?.settings?.customHeader?.split(":")[1] ?? "");

    setSubdomains(initial?.subdomains && initial.subdomains.length > 0 ? initial.subdomains : [""]);
    setOosSubdomains(
      initial?.outOfScopeSubdomains && initial.outOfScopeSubdomains.length > 0
        ? initial.outOfScopeSubdomains
        : [""]
    );

    setTouched({});
    setSaving(false);
    setTaskSearchQuery("");
  }

  function resetForm() {
    setName("");
    setDomain("");
    setActiveScan(true);
    setUserAgent("");
    setHeaderName("");
    setHeaderValue("");
    setSubdomains([]);
    setOosSubdomains([]);
    setTouched({});
    setSaving(false);
    setTasks([]);
    setTaskSearchQuery("");
  }

  function handleOpenChange(next: boolean) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
    if (next) initFromInitial();
    else resetForm();
  }

  // Render a subdomain list
  const renderList = (type: "sub" | "oos", list: string[], errors: Record<number, string>) => (
    <div className="border-border rounded-lg border p-2">
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {list.map((sd, idx) => {
          const err = errors[idx];
          const isTouched = type === "sub" ? touched.subs?.[idx] : touched.oos?.[idx];
          return (
            <div key={idx} className="space-y-1">
              <div className="relative">
                <Input
                  value={sd}
                  onChange={(e) => handleChangeRow(type, idx, e.target.value)}
                  onBlur={() =>
                    setTouched((s) => ({
                      ...s,
                      [type === "sub" ? "subs" : "oos"]: {
                        ...(s[type === "sub" ? "subs" : "oos"] || {}),
                        [idx]: true,
                      },
                    }))
                  }
                  placeholder={domain ? `*.${normalizeDomain(domain)}` : "*.example.com"}
                  className={`m-0.5 pr-20`}
                  aria-invalid={Boolean(isTouched && err)}
                />
                <div className="pointer-events-none absolute top-0 right-1 flex h-9 items-center gap-1">
                  <div className="pointer-events-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghostNoHover"
                      className="text-muted-foreground hover:text-foreground h-7 w-7"
                      onClick={() => handleAddRow(type, idx)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghostNoHover"
                      className="text-muted-foreground hover:text-destructive h-7 w-7"
                      onClick={() => handleRemoveRow(type, idx)}
                      disabled={list.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {isTouched && err ? (
                <p className="text-destructive text-xs font-medium">{err}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-[640px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {mode === "create" ? t("targets.dialog.createTitle") : t("targets.dialog.editTitle")}
            </DialogTitle>
            <DialogDescription>
              {mode === "create" ? t("targets.dialog.createDesc") : t("targets.dialog.editDesc")}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList>
              <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
              <TabsTrigger value="scope">{t("tabs.scope")}</TabsTrigger>
              <TabsTrigger value="advanced">{t("tabs.advanced")}</TabsTrigger>
              {mode === "edit" && <TabsTrigger value="tasks">{t("tabs.tasks")}</TabsTrigger>}
            </TabsList>

            {/* GENERAL TAB */}
            <TabsContent value="general">
              <div className="grid grid-cols-1 gap-5 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="target-name">{t("targets.form.companyName")}</Label>
                  <div className="flex items-center gap-3">
                    <div className="border-border bg-muted relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border">
                      {icon ? (
                        <img
                          src={icon}
                          alt="favicon"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                          <Globe2 className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <Input
                      id="target-name"
                      placeholder={t("common.company")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched((s) => ({ ...s, name: true }))}
                      required
                    />
                  </div>
                  {touched.name && nameError && (
                    <p className="text-destructive text-xs font-medium">{nameError}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="target-domain">{t("targets.form.mainDomain")}</Label>
                  <Input
                    id="target-domain"
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onBlur={() => setTouched((s) => ({ ...s, domain: true }))}
                    aria-invalid={touched.domain && Boolean(domainError)}
                    required
                  />
                  {touched.domain && domainError && (
                    <p className="text-destructive text-xs font-medium">{domainError}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="active-scan"
                    className="size-5"
                    checked={activeScan}
                    onCheckedChange={(checked) => setActiveScan(checked === true)}
                  />
                  <Label htmlFor="active-scan" className="cursor-pointer">
                    {t("targets.form.activeScan")}
                  </Label>
                </div>
              </div>
            </TabsContent>

            {/* SCOPE TAB */}
            <TabsContent value="scope">
              <div className="space-y-6 pt-2">
                {/* In Scope */}
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      {t("targets.form.subdomains")}
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddRow("sub")}
                    >
                      <Plus className="mr-1 h-4 w-4" /> {t("common.add")}
                    </Button>
                  </div>
                  {renderList("sub", subdomains, subdomainErrors)}
                  <p className="text-muted-foreground text-xs">
                    <Trans
                      i18nKey="targets.form.defaultScope"
                      values={{ domain: normalizeDomain(domain) || "domain.com" }}
                      components={{ code: <code /> }}
                    />
                  </p>
                </div>

                {/* Out of Scope */}
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      {t("targets.form.outOfScope")}
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddRow("oos")}
                    >
                      <Plus className="mr-1 h-4 w-4" /> {t("common.add")}
                    </Button>
                  </div>
                  {renderList("oos", oosSubdomains, oosErrors)}
                  <p className="text-muted-foreground text-xs">
                    {t("targets.form.outOfScopeHint")}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced">
              <div className="grid grid-cols-1 gap-5 pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="user-agent">User-Agent</Label>
                  <Input
                    id="user-agent"
                    placeholder="Mozilla/5.0..."
                    value={userAgent}
                    onChange={(e) => setUserAgent(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("targets.form.customHeader")}</Label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="X-Bug-Bounty"
                      value={headerName}
                      onChange={(e) => setHeaderName(e.target.value)}
                    />
                    <Input
                      placeholder="username"
                      value={headerValue}
                      onChange={(e) => setHeaderValue(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {mode === "edit" && (
              <TabsContent value="tasks">
                <div className="space-y-4 pt-2">
                  <Input
                    value={taskSearchQuery}
                    onChange={(e) => setTaskSearchQuery(e.target.value)}
                    placeholder={t("tasks.searchPlaceholder")}
                  />
                  {loadingTasks ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="border-border bg-card/60 h-24 animate-pulse rounded-lg border"
                        />
                      ))}
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="text-muted-foreground border-border bg-card/60 flex flex-col rounded-xl border p-8 text-center">
                      <p className="text-sm font-medium">{t("tasks.empty.title")}</p>
                    </div>
                  ) : (
                    <div className="scrollbar-thin max-h-[400px] space-y-3 overflow-y-auto pr-1">
                      {filteredTasks.map((task) => (
                        <div
                          key={task.id}
                          className="border-border bg-card hover:bg-muted/50 flex items-start gap-4 rounded-lg border p-4 transition-colors"
                        >
                          <div className="flex-1">
                            <h4 className="text-foreground text-sm font-semibold">{task.name}</h4>
                            <p className="text-muted-foreground text-xs">{task.description}</p>
                          </div>
                          <div className="m-auto flex items-center gap-3">
                            <Switch
                              checked={task.hasOverride ? task.overrideActive! : task.active}
                              onCheckedChange={() => toggleTaskOverride(task.id)}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy.has(task.id) || task.schedulingType === "GLOBAL"}
                              onClick={() => runTemplateForTarget(task.id)}
                            >
                              <Play className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving || hasErrors} className="min-w-[120px]">
              {saving ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : mode === "create" ? (
                t("common.add")
              ) : (
                t("common.save")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
