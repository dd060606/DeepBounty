import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AlertsTable from "@/components/alerts/AlertsTable";
import AlertsSkeleton from "@/components/alerts/AlertsSkeleton";
import type { Alert } from "@deepbounty/sdk/types";
import { toast } from "sonner";
import ApiClient from "@/utils/api";
import AlertDetailsDialog from "@/components/dialogs/AlertDetailsDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";

type AlertsResponse = {
  alerts: Alert[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 25;

export default function Alerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<Alert | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    alertIds: number[];
  }>({ open: false, alertIds: [] });

  async function fetchAlerts(nextPageIndex = 0, query = searchQuery) {
    try {
      const res = await ApiClient.get<AlertsResponse>("/alerts", {
        params: { page: nextPageIndex + 1, pageSize: PAGE_SIZE, search: query },
      });
      const data = res.data;
      const alerts = data.alerts ?? [];
      const resolvedPageSize = data.pageSize ?? PAGE_SIZE;
      const totalAlerts = data.total ?? alerts.length;
      const computedPageCount = Math.max(1, Math.ceil(totalAlerts / resolvedPageSize) || 1);
      const resolvedPageIndex = Math.min(
        Math.max(0, (data.page ?? nextPageIndex + 1) - 1),
        computedPageCount - 1
      );

      setAlerts(alerts);
      setTotal(totalAlerts);
      setPageSize(resolvedPageSize);
      setPageCount(computedPageCount);
      setPageIndex(resolvedPageIndex);
    } catch {
      toast.error(t("alerts.errors.loadAlerts"));
      setAlerts([]);
      setTotal(0);
      setPageSize(PAGE_SIZE);
      setPageCount(1);
    }
  }

  async function handleDeleteAlerts(alertIds: number[]) {
    try {
      // Delete all alerts in parallel
      await Promise.all(alertIds.map((id) => ApiClient.delete(`/alerts/${id}`)));

      const updatedTotal = Math.max(total - alertIds.length, 0);
      const updatedPageCount = Math.max(1, Math.ceil(updatedTotal / pageSize) || 1);
      const targetPageIndex = Math.min(pageIndex, updatedPageCount - 1);
      await fetchAlerts(targetPageIndex);

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

  function handlePageChange(nextPageIndex: number) {
    setPageIndex(nextPageIndex);
    fetchAlerts(nextPageIndex, searchQuery);
  }

  function handleSearch(newQuery: string) {
    setSearchQuery(newQuery);
    // Reset to first page
    setPageIndex(0);
    fetchAlerts(0, newQuery);
  }

  useEffect(() => {
    fetchAlerts(0, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-5 flex items-center justify-between md:mb-6">
        <h1 className="text-foreground text-xl font-semibold">{t("nav.alerts")}</h1>
      </div>

      {alerts === null ? (
        <AlertsSkeleton />
      ) : (
        <AlertsTable
          alerts={alerts}
          onRowClick={(alert) => {
            setSelected(alert);
          }}
          onDelete={(alertId) => openDeleteConfirm([alertId])}
          onDeleteMultiple={(alertIds) => openDeleteConfirm(alertIds)}
          pageIndex={pageIndex}
          pageCount={pageCount}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onSearch={handleSearch}
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
