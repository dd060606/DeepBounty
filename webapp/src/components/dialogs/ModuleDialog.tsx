import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ModuleSetting, Module, TaskTemplate } from "@deepbounty/sdk/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoIcon, Loader2Icon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiClient from "@/utils/api";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

type ModuleDialogProps = {
  module: Module;
  allTasks: TaskTemplate[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (settings: ModuleSetting[]) => Promise<void> | void;
  onTasksChange?: (updatedTasks: TaskTemplate[]) => void;
};

export default function ModuleDialog({
  module,
  allTasks,
  trigger,
  open: openProp,
  onOpenChange,
  onSubmit,
  onTasksChange,
}: ModuleDialogProps) {
  const { t } = useTranslation();
  const isControlled = typeof openProp === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? (openProp as boolean) : internalOpen;
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<ModuleSetting[]>([]);
  const [tasks, setTasks] = useState<TaskTemplate[]>([]);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");

  // Filter tasks for this module from the global task list
  useEffect(() => {
    const moduleTasks = allTasks
      .filter((task) => task.moduleId === module.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    setTasks(moduleTasks);
  }, [allTasks, module.id]);

  useEffect(() => {
    if (isOpen) {
      const initial = (module.settings || []).map((s) => ({ ...s }));
      setSettings(initial);
      setSaving(false);
      // Reset tasks to the current state from allTasks
      const moduleTasks = allTasks
        .filter((task) => task.moduleId === module.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      setTasks(moduleTasks);
      setTaskSearchQuery("");
    }
  }, [isOpen, module, allTasks]);

  const filteredTasks = useMemo(() => {
    const q = taskSearchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((task) => task.name.toLowerCase().includes(q));
  }, [tasks, taskSearchQuery]);

  function handleOpenChange(next: boolean) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  function updateSetting(name: string, value: string | boolean) {
    setSettings((prev) => prev.map((s) => (s.name === name ? { ...s, value } : s)));
  }

  function toggleTask(taskId: number) {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, active: !task.active } : task))
    );
  }

  function updateTaskInterval(taskId: number, interval: number) {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, interval } : task)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      // Update module settings
      await onSubmit?.(settings);

      // Update task statuses
      const taskUpdatePromises = tasks.map(async (task) => {
        try {
          await ApiClient.patch(`/tasks/templates/${task.id}`, {
            active: task.active,
            interval: task.interval,
          });
        } catch {
          toast.error(t("tasks.errors.updateTask"));
        }
      });
      await Promise.all(taskUpdatePromises);

      // Notify parent of task changes
      onTasksChange?.(tasks);

      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-[700px]">
        <form onSubmit={handleSubmit} className="flex max-h-[80vh] flex-col">
          {/* Title */}
          <DialogHeader>
            <DialogTitle className="text-foreground">{module.name}</DialogTitle>
            <DialogDescription>{t("modules.dialog.description")}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList>
              {/* If no settings, hide the general tab */}
              {settings.length > 0 && (
                <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
              )}
              <TabsTrigger value="tasks">{t("tabs.tasks")}</TabsTrigger>
            </TabsList>
            {/* Module settings */}
            <TabsContent value="general">
              {/* Scrollable content */}
              <div className="scrollbar-thin mt-4 flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {settings.map((s) => {
                    if (s.type === "info") {
                      // Info
                      return (
                        <Alert key={s.name}>
                          <InfoIcon />
                          <AlertTitle>{s.label}</AlertTitle>
                          <AlertDescription>{s.value as string}</AlertDescription>
                        </Alert>
                      );
                    }

                    if (s.type === "checkbox") {
                      // Checkbox
                      return (
                        <div key={s.name} className="flex items-center gap-3">
                          <Checkbox
                            id={s.name}
                            className="size-5"
                            checked={Boolean(s.value)}
                            onCheckedChange={(checked) => updateSetting(s.name, checked)}
                          />
                          <Label htmlFor={s.name} className="cursor-pointer">
                            {s.label}
                          </Label>
                        </div>
                      );
                    }

                    if (s.type === "select") {
                      // Select
                      return (
                        <div key={s.name} className="space-y-1">
                          <Label className="text-foreground text-xs font-medium">{s.label}</Label>
                          <Select
                            defaultValue={s.value as string}
                            onValueChange={(val) => updateSetting(s.name, val)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={s.label} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {s.options?.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    }

                    // Input
                    return (
                      <div key={s.name} className="space-y-1">
                        <div className="text-foreground text-xs font-medium">{s.label}</div>
                        <Input
                          value={String(s.value ?? "")}
                          onChange={(e) => updateSetting(s.name, e.target.value)}
                          placeholder={String(s.default ?? "")}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
            {/* Module tasks */}
            <TabsContent value="tasks">
              <div className="space-y-4 pt-2">
                {/* Search bar */}
                <Input
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  placeholder={t("tasks.searchPlaceholder")}
                />

                {/* Tasks list or loading/empty state */}
                {filteredTasks.length === 0 ? (
                  <div className="text-muted-foreground border-border bg-card/60 flex flex-col rounded-xl border p-8 text-center">
                    <p className="text-sm font-medium">{t("tasks.empty.title")}</p>
                    <p className="text-xs">{t("tasks.empty.hint")}</p>
                  </div>
                ) : (
                  <div className="scrollbar-thin max-h-[400px] space-y-3 overflow-y-auto pr-1">
                    {filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className="border-border bg-card hover:bg-muted/50 flex items-start gap-4 rounded-lg border p-4 transition-colors"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="text-foreground text-sm font-semibold">{task.name}</h4>
                          </div>
                          {task.description && (
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                              <span>{t("tasks.interval")}:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                value={task.interval}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (!isNaN(value) && value > 0) {
                                    updateTaskInterval(task.id, value);
                                  }
                                }}
                                className="h-7 w-20 text-xs"
                              />
                              <span className="text-muted-foreground text-xs">
                                {t("tasks.seconds")}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Enable task switch */}
                        <Switch checked={task.active} onCheckedChange={() => toggleTask(task.id)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            {/* Action buttons */}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => handleOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[120px]">
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                </span>
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
