import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SeverityBadge from "../alerts/SeverityBadge";
import type { Alert } from "@/utils/types";
import { faviconUrl } from "@/utils/domains";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/utils/date";

type AlertDetailsDialogProps = {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Parse <code></code> and newlines into React nodes safely
function renderDescription(description: string) {
  // Use [\s\S] to capture across newlines safely
  const segments = description.split(/(<code>[\s\S]*?<\/code>)/gi);

  const nodes: React.ReactNode[] = [];

  segments.forEach((seg, idx) => {
    // Render <code> blocks if they exist
    if (/^<code>/i.test(seg)) {
      const content = seg.replace(/<\/?code>/gi, "");
      nodes.push(
        <pre
          key={`code-${idx}`}
          className="bg-muted rounded p-2 font-mono text-[11px] whitespace-pre-wrap md:text-xs"
        >
          <code>{content}</code>
        </pre>
      );
    } else if (seg.length) {
      // outside <code>, handle newlines individually
      const lines = seg.split(/\n/);
      lines.forEach((line, i) => {
        nodes.push(
          <React.Fragment key={`text-${idx}-${i}`}>
            {line}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        );
      });
    }
  });

  return nodes;
}

export default function AlertDetailsDialog({ alert, open, onOpenChange }: AlertDetailsDialogProps) {
  const { t } = useTranslation();
  const icon = useMemo(() => (alert ? faviconUrl(alert.domain) : null), [alert]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]" aria-describedby={undefined}>
        {alert ? (
          <div className="space-y-6">
            <DialogHeader className="space-y-4">
              <div className="flex items-start gap-4">
                {/* Icon */}
                {icon ? (
                  <img
                    src={icon}
                    alt="favicon"
                    className="border-border bg-background mt-1 h-10 w-10 rounded-sm border object-cover"
                  />
                ) : null}
                {/* Title and badges */}
                <div className="flex flex-1 flex-col gap-2">
                  <DialogTitle className="text-foreground flex flex-col gap-2">
                    <span className="text-lg leading-tight font-semibold md:text-xl">
                      {alert.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{alert.id}</Badge>
                      <SeverityBadge score={alert.score} />
                      {alert.confirmed ? (
                        <Badge variant="default">{t("alerts.confirmed")}</Badge>
                      ) : (
                        <Badge variant="destructive">{t("alerts.unconfirmed")}</Badge>
                      )}
                    </div>
                  </DialogTitle>
                </div>
              </div>
              <Separator />
            </DialogHeader>

            {/* Info grid */}
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("common.company")}
                </p>
                <p className="font-medium">{alert.targetName}</p>
              </div>
              <div className="space-y-1 break-words">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("common.domain")}
                </p>
                <p className="font-medium">{alert.domain}</p>
              </div>
              <div className="space-y-1 break-words">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("common.subdomain")}
                </p>
                <p className="font-medium">{alert.subdomain}</p>
              </div>
              <div className="space-y-1 break-words">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("alerts.endpoint")}
                </p>
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px] md:text-xs">
                  {alert.endpoint}
                </code>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("alerts.score")}
                </p>
                <div>
                  <SeverityBadge score={alert.score} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("common.date")}
                </p>
                <p className="font-medium">{formatDate(alert.createdAt)}</p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">
                {t("alerts.description")}
              </p>
              <div className="prose prose-sm dark:prose-invert border-border bg-muted/30 [--tw-prose-bullets:theme(colors.foreground)] max-h-64 overflow-auto rounded-md border p-4 leading-relaxed">
                <p className="m-0 text-sm break-words whitespace-pre-line">
                  {renderDescription(alert.description)}
                </p>
              </div>
            </div>

            {/* Close button */}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
