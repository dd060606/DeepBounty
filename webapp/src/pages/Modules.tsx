import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import ModulesSkeleton from "@/components/modules/ModulesSkeleton";
import ApiClient from "@/utils/api";
import type { Module } from "@deepbounty/types";
import { Input } from "@/components/ui/input";
import { useMemo, useState as useReactState } from "react";
import ModuleCard from "@/components/modules/ModuleCard";

export default function Modules() {
  const { t } = useTranslation();
  const [modules, setModules] = useState<Module[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useReactState("");

  async function fetchModules() {
    setLoading(true);
    try {
      const res = await ApiClient.get<Module[]>("/modules");
      // Sort modules by name then id
      const list = (res.data || []).sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
      );
      setModules(list);
    } catch {
      toast.error(t("modules.errors.loadModules"));
      setModules([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!modules) return [];
    const q = query.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter((m) => {
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.version.toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q)
      );
    });
  }, [modules, query]);

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-5 flex items-center justify-between md:mb-6">
        <h1 className="text-foreground text-xl font-semibold">{t("nav.modules")}</h1>
      </div>

      {/* Search */}
      <div className="mb-6 flex justify-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("modules.searchPlaceholder")}
          className="w-lg"
        />
      </div>

      {loading || modules === null ? (
        <ModulesSkeleton />
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground border-border bg-card/60 mx-auto max-w-2xl rounded-xl border p-8 text-center">
          <p className="text-sm font-medium">{t("modules.empty.title")}</p>
          <p className="text-xs">{t("modules.empty.hint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              onSettingsChange={(newSettings) => {
                // Update the module settings in the list
                setModules(
                  (modules) =>
                    modules?.map((mod) =>
                      mod.id === m.id ? { ...mod, settings: newSettings } : mod
                    ) || null
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
