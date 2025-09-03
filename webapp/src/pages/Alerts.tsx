import { useState } from "react";
import { useTranslation } from "react-i18next";
import AlertsTable from "@/components/alerts/AlertsTable";
import AlertsSkeleton from "@/components/alerts/AlertsSkeleton";
import type { Alert } from "@/utils/types";

export default function Alerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Alert[] | null>([
    {
      id: 1,
      name: "Injection SQL détectée",
      targetName: "Acme Corp",
      domain: "acme.com",
      subdomain: "admin.acme.com",
      score: "critical",
      confirmed: false,
      description: "Paramètre 'id' vulnérable à une injection SQL dans l'endpoint users.",
      path: "/api/v1/users?id=1",
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      name: "Fuite d'informations",
      targetName: "Beta Solutions",
      domain: "beta.solutions",
      subdomain: "beta.solutions",
      score: "high",
      confirmed: true,
      description: "Fichiers internes exposés publiquement via le dossier /uploads.",
      path: "/uploads/",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: 3,
      name: "Sous-domaine non autorisé détecté",
      targetName: "Gamma Industries",
      domain: "gamma.io",
      subdomain: "staging.gamma.io",
      score: "medium",
      confirmed: false,
      path: "/",
      description: "Sous-domaine staging pointant vers une instance non sécurisée.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: 4,
      name: "Accès non autorisé détecté",
      targetName: "Delta Corp",
      domain: "delta.corp",
      subdomain: "api.delta.corp",
      score: "low",
      confirmed: false,
      path: "/api/v1/admin",
      description: "Tentative d'accès non autorisé à l'API admin.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: 5,
      name: "Accès non autorisé détecté",
      targetName: "Delta Corp",
      domain: "delta.corp",
      subdomain: "api.delta.corp",
      score: "informational",
      confirmed: false,
      path: "/api/v1/admin",
      description: "Tentative d'accès non autorisé à l'API admin.",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
  ]);
  const [loading, setLoading] = useState(false);

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-5 flex items-center justify-between md:mb-6">
        <h1 className="text-foreground text-xl font-semibold">{t("nav.alerts")}</h1>
      </div>

      {loading || alerts === null ? (
        <AlertsSkeleton />
      ) : (
        <AlertsTable alerts={alerts} onRowClick={() => {}} />
      )}
    </div>
  );
}
