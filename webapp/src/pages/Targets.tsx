import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TargetDialog from "@/components/dialogs/target-dialog";
import TargetCard from "@/components/targets/TargetCard";
import TargetSkeleton from "@/components/targets/TargetSkeleton";
import ApiClient from "@/utils/api";
import type { Target } from "@/utils/types";
import { normalizeDomain } from "@/utils/domains";
import { ConfirmDialog } from "@/components/dialogs/alerts";

export default function Targets() {
  const { t } = useTranslation();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<Target | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Target | null>(null);

  async function fetchTargets() {
    setLoading(true);
    try {
      const res = await ApiClient.get<Target[]>("/targets");
      // Sort targets by id
      const list = res.data.sort((a, b) => a.id - b.id) || [];
      // Fetch subdomains for each target in parallel
      const hydrated = await Promise.all(
        list.map(async (t) => {
          try {
            const sd = await ApiClient.get<string[]>(`/targets/subdomains/${t.id}`);
            return { ...t, subdomains: sd.data || [] } as Target;
          } catch {
            return { ...t, subdomains: [] } as Target;
          }
        })
      );
      setTargets(hydrated);
    } catch {
      toast.error(t("targets.errors.loadTargets"));
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTargets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter targets by query
  const filtered = useMemo(() => {
    if (!targets) return [];
    const q = query.trim().toLowerCase();
    if (!q) return targets;
    // Check name, domain, and subdomains
    return targets.filter((t) => {
      const name = t.name?.toLowerCase() || "";
      const domain = normalizeDomain(t.domain) || "";
      const subs = (t.subdomains || []).join(" ").toLowerCase();
      return name.includes(q) || domain.includes(q) || subs.includes(q);
    });
  }, [targets, query]);

  async function addNewTarget(data: Partial<Target>) {
    let res;
    let success = true;
    try {
      res = await ApiClient.post("/targets", {
        name: data.name,
        domain: data.domain,
        activeScan: data.activeScan,
      });
    } catch {
      success = false;
      toast.error(t("targets.errors.newTarget"));
    }
    try {
      if (res?.data.id) {
        await ApiClient.post(`/targets/subdomains/${res.data.id}`, data.subdomains);
      } else {
        throw new Error("No target ID returned from server");
      }
    } catch {
      success = false;
      toast.error(t("targets.errors.subdomains"));
    }
    if (success) {
      toast.success(t("targets.success.newTarget"));
      fetchTargets();
    }
  }

  async function updateTarget(id: number, data: Partial<Target>) {
    try {
      await ApiClient.patch(`/targets/${id}`, data);
      toast.success(t("targets.success.updated"));
      setEdit(null);
      fetchTargets();
    } catch {
      toast.error(t("targets.errors.updateTarget"));
    }
  }

  async function deleteTarget(id: number) {
    try {
      await ApiClient.delete(`/targets/${id}`);
      toast.success(t("targets.success.deleted"));
      setConfirmDelete(null);
      fetchTargets();
    } catch {
      toast.error(t("targets.errors.deleteTarget"));
    }
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-5 flex flex-row items-center justify-between gap-3 md:mb-2 md:px-3">
        <h1 className="text-foreground text-xl font-semibold">{t("nav.targets")}</h1>
        <TargetDialog
          mode="create"
          trigger={<Button className="shrink-0">{t("targets.newTarget")}</Button>}
          onSubmit={addNewTarget}
        />
      </div>
      <div className="mb-6 flex justify-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("targets.searchPlaceholder")}
          className="w-lg"
        />
      </div>

      {loading ? (
        // Show card skeletons while loading
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TargetSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground border-border bg-card/60 mx-auto max-w-2xl rounded-xl border p-8 text-center">
          <p className="text-sm font-medium">{t("targets.empty.title")}</p>
          <p className="text-xs">{t("targets.empty.hint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tgt) => (
            <TargetCard
              key={tgt.id}
              target={tgt}
              onEdit={(t) => {
                setEdit(t);
              }}
              onDelete={(t) => setConfirmDelete(t)}
            />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {edit ? (
        <TargetDialog
          mode="edit"
          initial={edit}
          open={true}
          onOpenChange={(o) => {
            if (!o) setEdit(null);
          }}
          onSubmit={async (data) => {
            // Update target
            await updateTarget(edit.id, {
              name: data.name,
              domain: data.domain,
              activeScan: data.activeScan,
            });
            // Then, update subdomains
            try {
              await ApiClient.post(`/targets/subdomains/${edit.id}`, data.subdomains);
            } catch {
              toast.error(t("targets.errors.subdomains"));
            }
            setEdit(null);
            fetchTargets();
          }}
        />
      ) : null}

      {/* Confirm delete */}
      {confirmDelete ? (
        <ConfirmDialog
          open={true}
          onOpenChange={() => setConfirmDelete(null)}
          title={t("targets.actions.confirmDelete")}
          desc={t("targets.actions.confirmDeleteDesc")}
          onConfirm={() => deleteTarget(confirmDelete.id)}
        />
      ) : null}
    </div>
  );
}
