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
import NotificationServicesSkeleton from "@/components/settings/NotificationServicesSkeleton";
import ApiClient from "@/utils/api";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useTheme } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router";
import type {
  NotificationService,
  NotificationProvider,
  NotificationConfigField,
} from "@deepbounty/sdk/types";
import { Input } from "@/components/ui/input";

interface NotificationProvidersResponse {
  [key: string]: NotificationProvider & {
    enabled?: boolean;
    config?: Record<string, string>;
  };
}

// Flexible state type for managing notification configs
interface NotificationState {
  provider: NotificationService["provider"];
  enabled: boolean;
  config: Record<string, string>;
}

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

  // Notifications
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationProviders, setNotificationProviders] = useState<NotificationProvidersResponse>(
    {}
  );
  const [notificationServices, setNotificationServices] = useState<NotificationState[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<NotificationService["provider"] | null>(
    null
  );
  const [savingNotification, setSavingNotification] = useState(false);

  // Confirm dialogs
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [confirmResetModules, setConfirmResetModules] = useState(false);
  const [confirmDisconnectWorker, setConfirmDisconnectWorker] = useState(false);
  const [workerToDisconnect, setWorkerToDisconnect] = useState<number | null>(null);
  const [confirmSwaggerToggle, setConfirmSwaggerToggle] = useState(false);
  const [pendingSwaggerValue, setPendingSwaggerValue] = useState(false);

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

  async function loadNotifications() {
    if (notificationsLoaded) return;
    setLoadingNotifications(true);
    try {
      const res = await ApiClient.get("/notifications");
      const data = res.data || {};

      // Extract providers configuration and services state
      const providers: NotificationProvidersResponse = {};
      const services: NotificationState[] = [];

      Object.keys(data).forEach((key) => {
        if (data[key].label && data[key].fields) {
          // This is a provider configuration
          providers[key] = data[key];
          services.push({
            provider: key as NotificationService["provider"],
            enabled: data[key].enabled || false,
            config: data[key].config || {},
          });
        }
      });

      setNotificationProviders(providers);
      setNotificationServices(services);

      // Select first provider by default
      const firstProvider = Object.keys(providers)[0];
      if (firstProvider) {
        setSelectedProvider(firstProvider as NotificationService["provider"]);
      }
    } catch {
      toast.error(t("settings.notifications.errorLoadingServices"));
    } finally {
      setLoadingNotifications(false);
      setNotificationsLoaded(true);
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

  function initiateSwaggerToggle(enabled: boolean) {
    setPendingSwaggerValue(enabled);
    setConfirmSwaggerToggle(true);
  }
  async function toggleSwagger(restart: boolean) {
    const enabled = pendingSwaggerValue;

    try {
      await ApiClient.patch("/settings", { swaggerUi: enabled, restart });
      setSwaggerEnabled(enabled);
      setConfirmSwaggerToggle(false);
      if (restart) {
        toast.info(t("settings.general.serverRestarting"));
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 2000);
      }
    } catch {
      toast.error(t("settings.general.errorSavingSettings"));
    } finally {
      setConfirmSwaggerToggle(false);
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

  async function saveNotificationService() {
    if (!selectedProvider) return;
    const service = notificationServices.find((s) => s.provider === selectedProvider);
    if (!service) return;

    setSavingNotification(true);
    try {
      await ApiClient.put(`/notifications/${selectedProvider}`, {
        enabled: service.enabled,
        config: service.config,
      });
      toast.success(t("settings.notifications.serviceSaved"));
    } catch {
      toast.error(t("settings.notifications.errorSavingService"));
    } finally {
      setSavingNotification(false);
    }
  }

  function toggleNotificationService(enabled: boolean) {
    if (!selectedProvider) return;
    setNotificationServices(
      notificationServices.map((s) => (s.provider === selectedProvider ? { ...s, enabled } : s))
    );
  }

  function updateNotificationConfig(key: string, value: string) {
    if (!selectedProvider) return;
    setNotificationServices(
      notificationServices.map((s) =>
        s.provider === selectedProvider ? { ...s, config: { ...s.config, [key]: value } } : s
      )
    );
  }

  async function restartServer() {
    try {
      await ApiClient.post("/settings/restart-server");
      toast.info(t("settings.general.serverRestarting"));
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
          if (value === "notifications" && !notificationsLoaded) {
            loadNotifications();
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
                <Switch checked={swaggerEnabled} onCheckedChange={initiateSwaggerToggle} />
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
          {loadingNotifications ? (
            <NotificationServicesSkeleton />
          ) : (
            <>
              <div>
                <h2 className="text-foreground mb-2 text-lg font-semibold">
                  {t("settings.notifications.title")}
                </h2>
                <p className="text-muted-foreground mb-6 text-sm">
                  {t("settings.notifications.description")}
                </p>

                {/* Service Selection Buttons */}
                <div className="mb-6 flex flex-wrap gap-3">
                  {Object.keys(notificationProviders).map((provider) => {
                    const providerInfo = notificationProviders[provider];
                    return (
                      <Button
                        key={provider}
                        variant={selectedProvider === provider ? "default" : "outline"}
                        onClick={() =>
                          setSelectedProvider(provider as NotificationService["provider"])
                        }
                      >
                        {providerInfo.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Service Configuration */}
              {selectedProvider && notificationProviders[selectedProvider] && (
                <>
                  <SettingSection
                    title={t("settings.notifications.configuration", {
                      service: notificationProviders[selectedProvider].label,
                    })}
                    description={t("settings.notifications.configurationDesc")}
                  >
                    {/* Enabled Toggle */}
                    <SettingItem
                      label={t("settings.notifications.enabled")}
                      description={t("settings.notifications.enabledDesc")}
                    >
                      <Switch
                        checked={
                          notificationServices.find((s) => s.provider === selectedProvider)
                            ?.enabled || false
                        }
                        onCheckedChange={toggleNotificationService}
                      />
                    </SettingItem>

                    {/* Configuration Fields */}
                    {notificationProviders[selectedProvider].fields.map(
                      (field: NotificationConfigField) => (
                        <SettingItem
                          key={field.name}
                          label={
                            <>
                              {t(`settings.notifications.${selectedProvider}.${field.name}`)}
                              {field.required && <span className="text-destructive ml-1">*</span>}
                            </>
                          }
                          description={t(
                            `settings.notifications.${selectedProvider}.${field.name}Desc`
                          )}
                        >
                          <Input
                            type={field.type}
                            placeholder={field.placeholder}
                            value={
                              (notificationServices.find((s) => s.provider === selectedProvider)
                                ?.config[field.name] as string) || ""
                            }
                            onChange={(e) => updateNotificationConfig(field.name, e.target.value)}
                            className="w-full sm:w-xs"
                            required={field.required}
                          />
                        </SettingItem>
                      )
                    )}
                    {/* Save Button */}
                    <div className="flex justify-end">
                      <Button onClick={saveNotificationService} disabled={savingNotification}>
                        {savingNotification ? t("common.saving") : t("common.save")}
                      </Button>
                    </div>
                  </SettingSection>
                </>
              )}
            </>
          )}
        </TabsContent>

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

      {/* Swagger Toggle Confirm with Restart Options */}
      <ConfirmDialog
        open={confirmSwaggerToggle}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmSwaggerToggle(false);
            setSwaggerEnabled(!pendingSwaggerValue);
          }
        }}
        title={t("settings.general.confirmSwaggerToggle")}
        desc={t("settings.general.confirmSwaggerToggleDesc")}
        onConfirm={() => toggleSwagger(true)}
        onCancel={() => toggleSwagger(false)}
        confirmText={t("settings.general.restartNow")}
        cancelText={t("settings.general.restartLater")}
      />
    </div>
  );
}
