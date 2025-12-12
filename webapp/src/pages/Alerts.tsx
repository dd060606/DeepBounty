import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AlertsTable from "@/components/alerts/AlertsTable";
import AlertsSkeleton from "@/components/alerts/AlertsSkeleton";
import type { Alert } from "@deepbounty/sdk/types";
import { toast } from "sonner";
import ApiClient from "@/utils/api";
import AlertDetailsDialog from "@/components/dialogs/AlertDetailsDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";

export default function Alerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    alertIds: number[];
  }>({ open: false, alertIds: [] });

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

  async function handleDeleteAlerts(alertIds: number[]) {
    try {
      // Delete all alerts in parallel
      await Promise.all(alertIds.map((id) => ApiClient.delete(`/alerts/${id}`)));

      // Update local state
      setAlerts((prev) => (prev ? prev.filter((a) => !alertIds.includes(a.id)) : []));

      // Show success message
      if (alertIds.length === 1) {
        toast.success(t("alerts.success.deleteAlert"));
      } else {
        toast.success(t("alerts.success.deleteAlerts", { count: alertIds.length }));
      }
    } catch {
      if (alertIds.length === 1) {
        toast.error(t("alerts.errors.deleteAlert"));
      } else {
        toast.error(t("alerts.errors.deleteAlerts"));
      }
    }
  }

  function openDeleteConfirm(alertIds: number[]) {
    setDeleteConfirm({ open: true, alertIds });
  }

  function closeDeleteConfirm() {
    setDeleteConfirm({ open: false, alertIds: [] });
  }

  async function confirmDelete() {
    await handleDeleteAlerts(deleteConfirm.alertIds);
    closeDeleteConfirm();
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
          onDelete={(alertId) => openDeleteConfirm([alertId])}
          onDeleteMultiple={(alertIds) => openDeleteConfirm(alertIds)}
        />
      )}

      <AlertDetailsDialog
        alert={selected}
        open={Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => {
          if (!open) closeDeleteConfirm();
        }}
        onConfirm={confirmDelete}
        onCancel={closeDeleteConfirm}
        title={
          deleteConfirm.alertIds.length === 1
            ? t("alerts.deleteConfirm.title")
            : t("alerts.deleteConfirm.titleMultiple")
        }
        desc={
          deleteConfirm.alertIds.length === 1
            ? t("alerts.deleteConfirm.description")
            : t("alerts.deleteConfirm.descriptionMultiple", {
                count: deleteConfirm.alertIds.length,
              })
        }
      />
    </div>
  );
}
