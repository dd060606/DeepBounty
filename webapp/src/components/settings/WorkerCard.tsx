import { Badge } from "@/components/ui/badge";
import { Monitor, Cpu, HardDrive, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";

type Worker = {
  id: string;
  name: string;
  status: "online" | "offline";
  connectedAt: string;
  cpu?: number;
  memory?: number;
  tasksCompleted?: number;
};

type Props = {
  worker: Worker;
};

export default function WorkerCard({ worker }: Props) {
  const { t } = useTranslation();
  const isOnline = worker.status === "online";

  return (
    <div className="border-border bg-card/50 rounded-lg border p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="text-primary size-5" />
          <div>
            <h4 className="text-foreground text-sm font-semibold">{worker.name}</h4>
            <p className="text-muted-foreground font-mono text-xs">{worker.id}</p>
          </div>
        </div>
        <Badge variant={isOnline ? "default" : "secondary"} className="text-xs">
          {isOnline ? t("settings.workers.online") : t("settings.workers.offline")}
        </Badge>
      </div>

      <div className="text-muted-foreground space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5" />
          <span>
            {t("settings.workers.connectedAt")}: {new Date(worker.connectedAt).toLocaleString()}
          </span>
        </div>
        {worker.cpu !== undefined && (
          <div className="flex items-center gap-2">
            <Cpu className="size-3.5" />
            <span>
              {t("settings.workers.cpu")}: {worker.cpu}%
            </span>
          </div>
        )}
        {worker.memory !== undefined && (
          <div className="flex items-center gap-2">
            <HardDrive className="size-3.5" />
            <span>
              {t("settings.workers.memory")}: {worker.memory}%
            </span>
          </div>
        )}
        {worker.tasksCompleted !== undefined && (
          <div className="flex items-center gap-2">
            <Activity className="size-3.5" />
            <span>
              {t("settings.workers.tasksCompleted")}: {worker.tasksCompleted}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
