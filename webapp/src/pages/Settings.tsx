import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiClient from "@/utils/api";
import GeneralTab from "./settings/GeneralTab";
import NotificationsTab from "./settings/NotificationsTab";
import WorkersTab from "./settings/WorkersTab";

export default function Settings() {
  const { t } = useTranslation();

  // General settings
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [burpsuiteKey, setBurpsuiteKey] = useState("");
  const [swaggerEnabled, setSwaggerEnabled] = useState(true);
  const [workerKey, setWorkerKey] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSettings() {
    try {
      const settingsRes = await ApiClient.get("/settings");
      if (settingsRes.data) {
        setBurpsuiteKey(settingsRes.data.burpsuiteKey);
        setWorkerKey(settingsRes.data.workerKey);
        setSwaggerEnabled(settingsRes.data.enableSwaggerUi);
        setExternalUrl(settingsRes.data.externalUrl || "");
      }
    } catch {
      toast.error(t("settings.general.errorLoadingSettings"));
    } finally {
      setLoadingSettings(false);
    }
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-foreground text-xl font-semibold">{t("nav.settings")}</h1>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="general">{t("settings.tabs.general")}</TabsTrigger>
          <TabsTrigger value="notifications">{t("settings.tabs.notifications")}</TabsTrigger>
          <TabsTrigger value="workers">{t("settings.tabs.workers")}</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <GeneralTab
            burpsuiteKey={burpsuiteKey}
            setBurpsuiteKey={setBurpsuiteKey}
            swaggerEnabled={swaggerEnabled}
            setSwaggerEnabled={setSwaggerEnabled}
            externalUrl={externalUrl}
            setExternalUrl={setExternalUrl}
            loadingSettings={loadingSettings}
          />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>

        {/* Workers Tab */}
        <TabsContent value="workers">
          <WorkersTab
            workerKey={workerKey}
            setWorkerKey={setWorkerKey}
            loadingSettings={loadingSettings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
