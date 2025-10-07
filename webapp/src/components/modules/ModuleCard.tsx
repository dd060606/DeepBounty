import type { ModuleSetting, Module } from "@deepbounty/types";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useState } from "react";
import ModuleDialog from "@/components/dialogs/ModuleDialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import ApiClient from "@/utils/api";

type Props = {
  module: Module;
  onClick?: (m: Module) => void;
  onSettingsChange?: (newSettings: ModuleSetting[]) => void;
};

export default function ModuleCard({ module, onClick, onSettingsChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  async function saveSettings(settings: ModuleSetting[]) {
    try {
      await ApiClient.post(`/modules/${module.id}/settings`, settings);
      toast.success(t("modules.dialog.saved"));
      onSettingsChange?.(settings);
    } catch {
      toast.error(t("modules.errors.saveSettings"));
      throw new Error("save failed");
    }
  }
  return (
    <div
      onClick={() => onClick?.(module)}
      className="border-border/60 bg-card/70 group relative flex w-full flex-col rounded-xl border p-4 text-left shadow-sm"
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div className="bg-primary border-border flex size-10 shrink-0 items-center justify-center rounded-md border text-sm font-semibold text-white">
          {(module.name?.slice(0, 3) || module.id?.slice(0, 3) || "M").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate text-sm font-semibold">{module.name}</div>
          {/* ID + Version */}
          <div className="text-muted-foreground truncate text-xs">
            <code>{module.id}</code>
            <span className="mx-2">•</span>
            <span>{module.version}</span>
          </div>
        </div>
        {/* Settings button */}
        <ModuleDialog
          module={module}
          open={open}
          onOpenChange={setOpen}
          onSubmit={saveSettings}
          trigger={
            <Button
              size="icon"
              variant="ghost"
              className="p-2"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
            >
              <Settings className="size-5" />
            </Button>
          }
        />
      </div>

      {module.description ? (
        <p className="text-muted-foreground mt-3 line-clamp-2 text-xs" title={module.description}>
          {module.description}
        </p>
      ) : null}
    </div>
  );
}
