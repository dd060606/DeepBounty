import type { Module } from "@/utils/types";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

type Props = {
  module: Module;
  onClick?: (m: Module) => void;
};

export default function ModuleCard({ module, onClick }: Props) {
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
        <Button size="icon" variant="ghost" className="p-2">
          <Settings className="size-5" />
        </Button>
      </div>

      {module.description ? (
        <p className="text-muted-foreground mt-3 line-clamp-2 text-xs" title={module.description}>
          {module.description}
        </p>
      ) : null}
    </div>
  );
}
