import { Badge } from "@/components/ui/badge";
import type { SeverityScore } from "@/utils/types";
import i18next from "i18next";

function classesForSeverity(s: SeverityScore): { label: string; className: string } {
  const t = (key: string) => i18next.t(key);
  switch (s) {
    case "informational":
      return {
        label: t("alerts.informational"),
        className: "border-transparent bg-foreground/20 dark:bg-foreground/60 text-foreground",
      };
    case "low":
      return {
        label: t("alerts.low"),
        className: "border-transparent bg-emerald-500/20 dark:bg-emerald-500/60 text-emerald-500",
      };
    case "medium":
      return {
        label: t("alerts.medium"),
        className: "border-transparent bg-amber-500/20 dark:bg-amber-500/60 text-amber-500",
      };
    case "high":
      return {
        label: t("alerts.high"),
        className: "border-transparent bg-red-500/20 dark:bg-red-500/60 text-red-500",
      };
    case "critical":
      return {
        label: t("alerts.critical"),
        className: "border-transparent bg-red-600/20 dark:bg-red-600/60 text-red-600",
      };
    default:
      return {
        label: String(s),
        className: "border-transparent bg-foreground/20 dark:bg-foreground/60 text-foreground",
      };
  }
}

export default function SeverityBadge({ severity }: { severity: SeverityScore }) {
  const { label, className } = classesForSeverity(severity);
  return <Badge className={`${className} dark:text-foreground/90`}>{label}</Badge>;
}
