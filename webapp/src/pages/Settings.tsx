import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Power, Trash2 } from "lucide-react";
import SettingSection from "@/components/settings/SettingSection";
import SettingItem from "@/components/settings/SettingItem";
import SecretField from "@/components/settings/SecretField";
import WorkerCard, { type WorkerInfo } from "@/components/settings/WorkerCard";
import WorkersSkeleton from "@/components/settings/WorkersSkeleton";
import ApiClient from "@/utils/api";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useTheme } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  // General settings
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [language, setLanguage] = useState(i18n.language.split("-")[0]);
  const [burpsuiteKey, setBurpsuiteKey] = useState("");
  const [swaggerEnabled, setSwaggerEnabled] = useState(true);
  const [regeneratingBurpsuite, setRegeneratingBurpsuite] = useState(false);

  // Workers
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [workersLoaded, setWorkersLoaded] = useState(false);
  const [workerKey, setWorkerKey] = useState("");
  const [regeneratingWorker, setRegeneratingWorker] = useState(false);
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);

  // Confirm dialogs
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [confirmResetModules, setConfirmResetModules] = useState(false);
  const [confirmDisconnectWorker, setConfirmDisconnectWorker] = useState(false);
  const [workerToDisconnect, setWorkerToDisconnect] = useState<number | null>(null);

  useEffect(() => {
    // Load settings from API
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    try {
      // Load general settings
      const settingsRes = await ApiClient.get("/settings");
      if (settingsRes.data) {
        setBurpsuiteKey(settingsRes.data.burpsuiteKey);
        setWorkerKey(settingsRes.data.workerKey);
        setSwaggerEnabled(settingsRes.data.enableSwaggerUi);
      }
    } catch {
      toast.error(t("settings.general.errorLoadingSettings"));
    } finally {
      setLoadingSettings(false);
    }
  }

  async function loadConnectedWorkers() {
    if (workersLoaded) return;
    setLoadingWorkers(true);
    try {
      // Load workers list
      const workersRes = await ApiClient.get("/workers");
      if (workersRes.data) {
        setWorkers(workersRes.data || []);
      }
    } catch {
      toast.error(t("settings.workers.errorLoadingWorkers"));
    } finally {
      setLoadingWorkers(false);
      setWorkersLoaded(true);
    }
  }

  async function changeLanguage(lang: string) {
    setLanguage(lang);
    await i18n.changeLanguage(lang);
    toast.success(t("settings.general.languageChanged"));
  }

  async function regenerateBurpsuiteToken() {
    setRegeneratingBurpsuite(true);
    try {
      const res = await ApiClient.post("/settings/regenerate/burpsuite-key");
      setBurpsuiteKey(res.data.burpsuiteKey);
      toast.success(t("settings.general.tokenRegenerated"));
    } catch {
      toast.error(t("settings.general.errorRegeneratingToken"));
    } finally {
      setRegeneratingBurpsuite(false);
    }
  }

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

  function initiateDisconnectWorker(id: number) {
    setWorkerToDisconnect(id);
    setConfirmDisconnectWorker(true);
  }

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

  async function toggleSwagger(enabled: boolean) {
    setSwaggerEnabled(enabled);
    try {
      await ApiClient.patch("/settings", { swaggerUi: enabled });
      toast.success(t("settings.general.settingsSaved"));
    } catch {
      toast.error(t("settings.general.errorSavingSettings"));
    }
  }

  async function cleanupTasks() {
    try {
      await ApiClient.post("/settings/cleanup-tasks");
      toast.success(t("settings.advanced.cleanupSuccess"));
      // The server is expected to restart after this action
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch {
      toast.error(t("settings.advanced.cleanupError"));
    } finally {
      setConfirmCleanup(false);
    }
  }

  async function resetModulesDatabase() {
    try {
      await ApiClient.post("/settings/reset-modules");
      toast.success(t("settings.advanced.resetSuccess"));
      // The server is expected to restart after this action
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch {
      toast.error(t("settings.advanced.resetError"));
    } finally {
      setConfirmResetModules(false);
    }
  }

  async function restartServer() {
    try {
      await ApiClient.post("/settings/restart-server");
      toast.success(t("settings.advanced.restartSuccess"));
      // The server is expected to restart after this action
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch {
      toast.error(t("settings.advanced.restartError"));
    }
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-foreground text-xl font-semibold">{t("nav.settings")}</h1>
      </div>

      <Tabs
        defaultValue="general"
        className="w-full"
        onValueChange={(value) => {
          if (value === "workers" && !workersLoaded) {
            loadConnectedWorkers();
          }
        }}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="general">{t("settings.tabs.general")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("settings.tabs.notifications")}</TabsTrigger>
          <TabsTrigger value="workers">{t("settings.tabs.workers")}</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <SettingSection
            title={t("settings.general.title")}
            description={t("settings.general.description")}
          >
            {/* Language */}
            <SettingItem
              label={t("settings.general.language")}
              description={t("settings.general.languageDesc")}
            >
              <Select value={language} onValueChange={changeLanguage}>
                <SelectTrigger className="w-xs sm:w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                </SelectContent>
              </Select>
            </SettingItem>

            {/* Burp Suite Token */}
            <SettingItem
              label={t("settings.general.burpsuiteToken")}
              description={t("settings.general.burpsuiteTokenDesc")}
            >
              {loadingSettings ? (
                <Skeleton className="h-8 w-xs sm:w-sm" />
              ) : (
                <SecretField
                  value={burpsuiteKey}
                  onRegenerate={regenerateBurpsuiteToken}
                  regenerating={regeneratingBurpsuite}
                />
              )}
            </SettingItem>

            {/* Swagger UI */}
            <SettingItem
              label={t("settings.general.swaggerUI")}
              description={t("settings.general.swaggerUIDesc")}
            >
              {loadingSettings ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <Switch checked={swaggerEnabled} onCheckedChange={toggleSwagger} />
              )}
            </SettingItem>

            {/* Theme */}
            <SettingItem
              label={t("settings.general.darkMode")}
              description={t("settings.general.darkModeDesc")}
            >
              {loadingSettings ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={() => setTheme(theme === "dark" ? "light" : "dark")}
                />
              )}
            </SettingItem>
          </SettingSection>

          <SettingSection
            title={t("settings.advanced.title")}
            description={t("settings.advanced.description")}
          >
            {/* Cleanup Tasks */}
            <SettingItem
              label={t("settings.advanced.cleanupTasks")}
              description={t("settings.advanced.cleanupTasksDesc")}
            >
              <Button
                variant="outline"
                onClick={() => setConfirmCleanup(true)}
                className="text-destructive"
              >
                <Trash2 className="size-4" />
                {t("settings.advanced.cleanup")}
              </Button>
            </SettingItem>

            {/* Reset Modules Databases */}
            <SettingItem
              label={t("settings.advanced.resetModules")}
              description={t("settings.advanced.resetModulesDesc")}
            >
              <Button
                variant="outline"
                onClick={() => setConfirmResetModules(true)}
                className="text-destructive"
              >
                <AlertTriangle className="size-4" />
                {t("settings.advanced.reset")}
              </Button>
            </SettingItem>

            {/* Restart Server */}
            <SettingItem
              label={t("settings.advanced.restartServer")}
              description={t("settings.advanced.restartServerDesc")}
            >
              <Button variant="outline" onClick={restartServer} className="text-destructive">
                <Power className="size-4" />
                {t("settings.advanced.restart")}
              </Button>
            </SettingItem>
          </SettingSection>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-foreground text-lg font-semibold">
                {t("settings.notifications.title")}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t("settings.notifications.description")}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Workers Tab */}
        <TabsContent value="workers" className="space-y-6">
          <SettingSection
            title={t("settings.workers.title")}
            description={t("settings.workers.description")}
          >
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

          {loadingWorkers ? (
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
        </TabsContent>
      </Tabs>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmCleanup}
        onOpenChange={setConfirmCleanup}
        title={t("settings.advanced.confirmCleanup")}
        desc={t("settings.advanced.confirmCleanupDesc")}
        onConfirm={cleanupTasks}
      />

      <ConfirmDialog
        open={confirmResetModules}
        onOpenChange={setConfirmResetModules}
        title={t("settings.advanced.confirmReset")}
        desc={t("settings.advanced.confirmResetDesc")}
        onConfirm={resetModulesDatabase}
      />

      <ConfirmDialog
        open={confirmDisconnectWorker}
        onOpenChange={setConfirmDisconnectWorker}
        title={t("settings.workers.confirmDisconnect")}
        desc={t("settings.workers.confirmDisconnectDesc")}
        onConfirm={disconnectWorker}
      />
    </div>
  );
}
