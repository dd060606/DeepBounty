import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import SettingSection from "@/components/settings/SettingSection";
import SettingItem from "@/components/settings/SettingItem";
import NotificationServicesSkeleton from "@/components/settings/NotificationServicesSkeleton";
import ApiClient from "@/utils/api";
import type {
  NotificationService,
  NotificationProvider,
  NotificationConfigField,
} from "@deepbounty/sdk/types";
import { Input } from "@/components/ui/input";
import type { AxiosError } from "axios";

interface NotificationProvidersResponse {
  [key: string]: NotificationProvider & {
    enabled?: boolean;
    config?: Record<string, string>;
  };
}

interface NotificationState {
  provider: NotificationService["provider"];
  enabled: boolean;
  config: Record<string, string>;
}

export default function NotificationsTab() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notificationProviders, setNotificationProviders] = useState<NotificationProvidersResponse>(
    {}
  );
  const [notificationServices, setNotificationServices] = useState<NotificationState[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<NotificationService["provider"] | null>(
    null
  );
  const [savingNotification, setSavingNotification] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);

  useEffect(() => {
    if (!loaded) {
      loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load notification services configuration
  async function loadNotifications() {
    setLoading(true);
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
      setLoading(false);
      setLoaded(true);
    }
  }

  // Save notification service configuration
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

  // Test notification service configuration
  async function testNotificationService() {
    if (!selectedProvider) return;
    const service = notificationServices.find((s) => s.provider === selectedProvider);
    if (!service) return;

    setTestingNotification(true);
    try {
      await ApiClient.post(`/notifications/${selectedProvider}/test`, {
        config: service.config,
      });
      toast.success(t("settings.notifications.testSent"));
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string }>;
      const errorMessage =
        axiosError.response?.data?.error || axiosError.message || "Unknown error";
      console.log(axiosError);
      toast.error(t("settings.notifications.errorTestingService", { error: errorMessage }));
    } finally {
      setTestingNotification(false);
    }
  }

  // Toggle notification service enabled state
  function toggleNotificationService(enabled: boolean) {
    if (!selectedProvider) return;
    setNotificationServices(
      notificationServices.map((s) => (s.provider === selectedProvider ? { ...s, enabled } : s))
    );
  }

  // Update notification service configuration field
  function updateNotificationConfig(key: string, value: string) {
    if (!selectedProvider) return;
    setNotificationServices(
      notificationServices.map((s) =>
        s.provider === selectedProvider ? { ...s, config: { ...s.config, [key]: value } } : s
      )
    );
  }

  if (loading) {
    return <NotificationServicesSkeleton />;
  }

  return (
    <div className="space-y-6">
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
                onClick={() => setSelectedProvider(provider as NotificationService["provider"])}
              >
                {providerInfo.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Service Configuration */}
      {selectedProvider && notificationProviders[selectedProvider] && (
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
                notificationServices.find((s) => s.provider === selectedProvider)?.enabled || false
              }
              onCheckedChange={toggleNotificationService}
            />
          </SettingItem>

          {/* Configuration Fields */}
          {notificationProviders[selectedProvider].fields.map((field: NotificationConfigField) => (
            <SettingItem
              key={field.name}
              label={
                <>
                  {t(`settings.notifications.${selectedProvider}.${field.name}`)}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </>
              }
              description={t(`settings.notifications.${selectedProvider}.${field.name}Desc`)}
            >
              <Input
                type={field.type}
                placeholder={field.placeholder}
                value={
                  (notificationServices.find((s) => s.provider === selectedProvider)?.config[
                    field.name
                  ] as string) || ""
                }
                onChange={(e) => updateNotificationConfig(field.name, e.target.value)}
                className="w-full sm:w-xs"
                required={field.required}
              />
            </SettingItem>
          ))}

          {/* Save and Test Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={testNotificationService}
              disabled={testingNotification || savingNotification}
            >
              {testingNotification
                ? t("settings.notifications.testing")
                : t("settings.notifications.testNotification")}
            </Button>
            <Button
              onClick={saveNotificationService}
              disabled={savingNotification || testingNotification}
            >
              {savingNotification ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </SettingSection>
      )}
    </div>
  );
}
