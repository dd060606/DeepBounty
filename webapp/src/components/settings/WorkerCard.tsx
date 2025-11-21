import { Badge } from "@/components/ui/badge";
import { Monitor, Clock, Activity, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";

export type WorkerInfo = {
  id: number;
  ip?: string;
  connectedAt: Date;
  tasksCount: number;
  toolsCount: number;
};

export default function WorkerCard({ worker }: { worker: WorkerInfo }) {
  const { t } = useTranslation();

  return (
    <div className="border-border bg-card/50 rounded-lg border p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="text-primary size-5" />
          <div>
            <h4 className="text-foreground text-sm font-semibold">Worker {worker.id}</h4>
            <p className="text-muted-foreground font-mono text-xs">{worker.ip || ""}</p>
          </div>
        </div>
        <Badge variant={"default"} className="text-xs">
          {t("settings.workers.online")}
        </Badge>
      </div>

      <div className="text-muted-foreground space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5" />
          <span>
            {t("settings.workers.tasksRunning")}: {worker.tasksCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Wrench className="size-3.5" />
          <span>
            {t("settings.workers.installedTools")}: {worker.toolsCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-3.5" />
          <span>
            {t("settings.workers.connectedAt")}: {new Date(worker.connectedAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
