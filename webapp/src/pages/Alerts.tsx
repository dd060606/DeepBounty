import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AlertsTable from "@/components/alerts/AlertsTable";
import AlertsSkeleton from "@/components/alerts/AlertsSkeleton";
import type { Alert } from "@/utils/types";
import { toast } from "sonner";
import ApiClient from "@/utils/api";
import AlertDetailsDialog from "@/components/dialogs/AlertDetailsDialog";

export default function Alerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Alert | null>(null);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const res = await ApiClient.get<Alert[]>("/alerts");
      // Sort alerts by id
      const alerts = res.data.sort((a, b) => b.id - a.id) || [];
      setAlerts(alerts);
    } catch {
      toast.error(t("alerts.errors.loadAlerts"));
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-5 flex items-center justify-between md:mb-6">
        <h1 className="text-foreground text-xl font-semibold">{t("nav.alerts")}</h1>
      </div>

      {loading || alerts === null ? (
        <AlertsSkeleton />
      ) : (
        <AlertsTable
          alerts={alerts}
          onRowClick={(alert) => {
            setSelected(alert);
          }}
        />
      )}

      <AlertDetailsDialog
        alert={selected}
        open={Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />
    </div>
  );
}
