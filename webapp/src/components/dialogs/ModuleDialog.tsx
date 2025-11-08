import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ModuleSetting, Module } from "@deepbounty/sdk/types";
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

type ModuleDialogProps = {
  module: Module;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (settings: ModuleSetting[]) => Promise<void> | void;
};

export default function ModuleDialog({
  module,
  trigger,
  open: openProp,
  onOpenChange,
  onSubmit,
}: ModuleDialogProps) {
  const { t } = useTranslation();
  const isControlled = typeof openProp === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? (openProp as boolean) : internalOpen;
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<ModuleSetting[]>([]);

  useEffect(() => {
    if (isOpen) {
      const initial = (module.settings || []).map((s) => ({ ...s }));
      setSettings(initial);
      setSaving(false);
    }
  }, [isOpen, module]);

  function handleOpenChange(next: boolean) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  function updateSetting(name: string, value: string | boolean) {
    setSettings((prev) => prev.map((s) => (s.name === name ? { ...s, value } : s)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSubmit?.(settings);
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
              <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
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
            <TabsContent value="tasks"></TabsContent>
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
