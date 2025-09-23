import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Module, ModuleSetting } from "@/utils/types";
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
import { Loader2Icon } from "lucide-react";

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

          {/* Scrollable content */}
          <div className="border-border/60 bg-card/50 scrollbar-thin mt-4 flex-1 overflow-y-auto rounded-md border p-4">
            <div className="space-y-4">
              {settings.map((s) => {
                if (s.type === "info") {
                  return (
                    <div key={s.name} className="text-muted-foreground text-sm">
                      <div className="text-foreground mb-1 text-xs font-medium">{s.label}</div>
                      <div className="bg-muted/40 rounded-md p-3 text-xs">
                        {String(s.value ?? s.default)}
                      </div>
                    </div>
                  );
                }

                if (s.type === "checkbox") {
                  // No custom style yet, keep minimal native checkbox
                  return (
                    <label key={s.name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(s.value)}
                        onChange={(e) => updateSetting(s.name, e.target.checked)}
                      />
                      <span className="text-foreground">{s.label}</span>
                    </label>
                  );
                }

                if (s.type === "select") {
                  // Keep unstyled native select for now
                  return (
                    <div key={s.name} className="space-y-1">
                      <div className="text-foreground text-xs font-medium">{s.label}</div>
                      <select
                        className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
                        value={String(s.value)}
                        onChange={(e) => updateSetting(s.name, e.target.value)}
                      >
                        {(s.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                // text
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

          <DialogFooter className="mt-4">
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
