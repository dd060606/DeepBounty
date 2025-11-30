import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import ApiClient from "@/utils/api";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useTheme } from "@/components/theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router";

interface GeneralTabProps {
  burpsuiteKey: string;
  setBurpsuiteKey: (key: string) => void;
  swaggerEnabled: boolean;
  setSwaggerEnabled: (enabled: boolean) => void;
  loadingSettings: boolean;
}

export default function GeneralTab({
  burpsuiteKey,
  setBurpsuiteKey,
  swaggerEnabled,
  setSwaggerEnabled,
  loadingSettings,
}: GeneralTabProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [language, setLanguage] = useState(i18n.language.split("-")[0]);
  const [regeneratingBurpsuite, setRegeneratingBurpsuite] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [confirmResetModules, setConfirmResetModules] = useState(false);
  const [confirmSwaggerToggle, setConfirmSwaggerToggle] = useState(false);
  const [pendingSwaggerValue, setPendingSwaggerValue] = useState(false);

  // Change UI language
  async function changeLanguage(lang: string) {
    setLanguage(lang);
    await i18n.changeLanguage(lang);
    toast.success(t("settings.general.languageChanged"));
  }

  // Regenerate Burp Suite token
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

  function initiateSwaggerToggle(enabled: boolean) {
    setPendingSwaggerValue(enabled);
    setConfirmSwaggerToggle(true);
  }

  // Toggle Swagger UI with optional restart
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

  // Cleanup registered tasks (requires server restart)
  async function cleanupTasks() {
    try {
      await ApiClient.post("/settings/cleanup-tasks");
      toast.success(t("settings.advanced.cleanupSuccess"));
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch {
      toast.error(t("settings.advanced.cleanupError"));
    } finally {
      setConfirmCleanup(false);
    }
  }

  // Reset modules database (requires server restart)
  async function resetModulesDatabase() {
    try {
      await ApiClient.post("/settings/reset-modules");
      toast.success(t("settings.advanced.resetSuccess"));
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch {
      toast.error(t("settings.advanced.resetError"));
    } finally {
      setConfirmResetModules(false);
    }
  }

  // Restart server
  async function restartServer() {
    try {
      await ApiClient.post("/settings/restart-server");
      toast.info(t("settings.general.serverRestarting"));
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    } catch {
      toast.error(t("settings.advanced.restartError"));
    }
  }

  return (
    <>
      <div className="space-y-6">
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
      </div>

      {/* Confirm cleanup */}
      <ConfirmDialog
        open={confirmCleanup}
        onOpenChange={setConfirmCleanup}
        title={t("settings.advanced.confirmCleanup")}
        desc={t("settings.advanced.confirmCleanupDesc")}
        onConfirm={cleanupTasks}
      />

      {/* Confirm reset modules */}
      <ConfirmDialog
        open={confirmResetModules}
        onOpenChange={setConfirmResetModules}
        title={t("settings.advanced.confirmReset")}
        desc={t("settings.advanced.confirmResetDesc")}
        onConfirm={resetModulesDatabase}
      />

      {/* Swagger Toggle Confirmation */}
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
    </>
  );
}
