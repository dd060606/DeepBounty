import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2 } from "lucide-react";
import { faviconUrl, normalizeDomain } from "@/utils/domains";
import type { Target } from "@/utils/types";
import { useTranslation } from "react-i18next";

type Props = {
  target: Target;
  onEdit?: (t: Target) => void;
  onDelete?: (t: Target) => void;
};

export default function TargetCard({ target, onEdit, onDelete }: Props) {
  const icon = useMemo(() => faviconUrl(target.domain), [target.domain]);
  const domain = normalizeDomain(target.domain);
  const { t } = useTranslation();
  const subs = target.subdomains || [];

  return (
    <div className="border-border/60 bg-card/70 supports-[backdrop-filter]:bg-card/50 group dark:hover:shadow-accent/20 relative flex flex-col rounded-xl border p-4 shadow-sm backdrop-blur transition">
      {/* Scan indicator */}
      <span
        className="absolute top-2 right-2 h-2 w-2"
        title={target.activeScan ? t("targets.activeScan") : t("targets.inactiveScan")}
        aria-label={target.activeScan ? t("targets.activeScan") : t("targets.inactiveScan")}
      >
        <span
          className={`absolute inset-0 animate-ping rounded-full opacity-60 ${
            target.activeScan ? "bg-primary/60" : "bg-destructive/60"
          }`}
        />
        <span
          className={`border-background relative block h-2 w-2 rounded-full ${
            target.activeScan ? "bg-primary" : "bg-destructive"
          }`}
        />
      </span>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="border-border bg-muted relative size-10 flex-shrink-0 overflow-hidden rounded-md border">
          {icon ? (
            <img src={icon} alt="favicon" className="h-full w-full object-cover" />
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xs font-medium">
              {domain?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </div>
        {/* Info */}
        <div className="min-w-0">
          <div className="text-foreground truncate text-sm font-semibold">{target.name} </div>
          <div className="text-muted-foreground truncate text-xs">{domain}</div>
        </div>
        {/* Actions */}
        <div className="ml-auto gap-2">
          <Button size="icon" variant="ghost" className="p-2" onClick={() => onEdit?.(target)}>
            <Pencil className="size-5" />
          </Button>
          <Button size="icon" variant="ghost" className="p-2" onClick={() => onDelete?.(target)}>
            <Trash2 className="size-5" />
          </Button>
        </div>
      </div>
      {/* Subdomains */}
      {subs.length > 0 ? (
        <>
          <Separator className="my-3" />
          <div className="flex flex-wrap gap-1.5">
            {subs.slice(0, 6).map((s, i) => (
              <span
                key={i}
                className="border-border text-muted-foreground/90 bg-muted/50 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px]"
              >
                {s}
              </span>
            ))}
            {subs.length > 6 ? (
              <span className="text-muted-foreground/80 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px]">
                +{subs.length - 6}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
