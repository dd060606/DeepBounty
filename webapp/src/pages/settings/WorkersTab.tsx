import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import SettingSection from "@/components/settings/SettingSection";
import SettingItem from "@/components/settings/SettingItem";
import SecretField from "@/components/settings/SecretField";
import WorkerCard, { type WorkerInfo } from "@/components/settings/WorkerCard";
import WorkersSkeleton from "@/components/settings/WorkersSkeleton";
import ApiClient from "@/utils/api";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkersTabProps {
  workerKey: string;
  setWorkerKey: (key: string) => void;
  loadingSettings: boolean;
}

export default function WorkersTab({ workerKey, setWorkerKey, loadingSettings }: WorkersTabProps) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [regeneratingWorker, setRegeneratingWorker] = useState(false);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [confirmDisconnectWorker, setConfirmDisconnectWorker] = useState(false);
  const [workerToDisconnect, setWorkerToDisconnect] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded) {
      loadConnectedWorkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load connected workers
  async function loadConnectedWorkers() {
    setLoading(true);
    try {
      const workersRes = await ApiClient.get("/workers");
      if (workersRes.data) {
        setWorkers(workersRes.data || []);
      }
    } catch {
      toast.error(t("settings.workers.errorLoadingWorkers"));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  // Regenerate worker secret
  async function regenerateWorkerSecret() {
    setRegeneratingWorker(true);
    try {
      const res = await ApiClient.post("/settings/regenerate/worker-key");
      setWorkerKey(res.data.workerKey);
      toast.success(t("settings.workers.secretRegenerated"));
    } catch {
      toast.error(t("settings.workers.errorRegeneratingSecret"));
    } finally {
      setRegeneratingWorker(false);
    }
  }

  // Initiate disconnect worker confirmation
  function initiateDisconnectWorker(id: number) {
    setWorkerToDisconnect(id);
    setConfirmDisconnectWorker(true);
  }

  // Disconnect worker (Close worker process)
  async function disconnectWorker() {
    if (workerToDisconnect === null) return;
    try {
      await ApiClient.post(`/workers/${workerToDisconnect}/disconnect`);
      toast.success(t("settings.workers.disconnectSuccess"));
      setWorkers(workers.filter((w) => w.id !== workerToDisconnect));
    } catch {
      toast.error(t("settings.workers.disconnectError"));
    } finally {
      setConfirmDisconnectWorker(false);
      setWorkerToDisconnect(null);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <SettingSection
          title={t("settings.workers.title")}
          description={t("settings.workers.description")}
        >
          {/* Worker Server Secret */}
          <SettingItem
            label={t("settings.workers.serverSecret")}
            description={t("settings.workers.serverSecretDesc")}
          >
            {loadingSettings ? (
              <Skeleton className="h-8 w-xs sm:w-sm" />
            ) : (
              <SecretField
                value={workerKey}
                onRegenerate={regenerateWorkerSecret}
                regenerating={regeneratingWorker}
              />
            )}
          </SettingItem>
        </SettingSection>

        {/* Connected Workers */}
        {loading ? (
          <WorkersSkeleton />
        ) : (
          <div>
            <h3 className="text-foreground mb-4 text-base font-semibold">
              {t("settings.workers.connectedWorkers")} ({workers.length})
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  onDisconnect={initiateDisconnectWorker}
                />
              ))}
            </div>

            {workers.length === 0 && (
              <div className="text-muted-foreground border-border bg-card/60 rounded-xl border p-8 text-center">
                <p className="text-sm">{t("settings.workers.noWorkers")}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm disconnect worker */}
      <ConfirmDialog
        open={confirmDisconnectWorker}
        onOpenChange={setConfirmDisconnectWorker}
        title={t("settings.workers.confirmDisconnect")}
        desc={t("settings.workers.confirmDisconnectDesc")}
        onConfirm={disconnectWorker}
      />
    </>
  );
}
