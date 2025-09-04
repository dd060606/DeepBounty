import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

function classesForSeverity(s: number): { label: string; className: string } {
  switch (s) {
    case 0:
      return {
        label: "alerts.informational",
        className: "border-transparent bg-foreground/20 dark:bg-foreground/60 text-foreground",
      };
    case 1:
      return {
        label: "alerts.low",
        className: "border-transparent bg-emerald-500/20 dark:bg-emerald-500/60 text-emerald-500",
      };
    case 2:
      return {
        label: "alerts.medium",
        className: "border-transparent bg-amber-500/20 dark:bg-amber-500/60 text-amber-500",
      };
    case 3:
      return {
        label: "alerts.high",
        className: "border-transparent bg-red-500/20 dark:bg-red-500/60 text-red-500",
      };
    case 4:
      return {
        label: "alerts.critical",
        className: "border-transparent bg-red-600/20 dark:bg-red-600/60 text-red-600",
      };
    default:
      return {
        label: String(s),
        className: "border-transparent bg-foreground/20 dark:bg-foreground/60 text-foreground",
      };
  }
}

export default function SeverityBadge({ score }: { score: number }) {
  const { label, className } = classesForSeverity(score);
  const { t } = useTranslation();
  return <Badge className={`${className} dark:text-foreground/90`}>{t(label)}</Badge>;
}
