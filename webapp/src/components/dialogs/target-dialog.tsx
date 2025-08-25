import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Loader2Icon, Globe2 } from "lucide-react";
import { defaultWildcard, faviconUrl, normalizeDomain } from "@/utils/domains";

type TargetData = {
  name: string;
  domain: string;
  subdomains: string[];
  activeScan: boolean;
};

type TargetDialogProps = {
  mode?: "create" | "edit";
  trigger?: React.ReactNode;
  initial?: Partial<TargetData>;
  onSubmit?: (data: TargetData) => Promise<void> | void;
};

export default function TargetDialog({
  mode = "create",
  trigger,
  initial,
  onSubmit,
}: TargetDialogProps) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  //Target data
  const [name, setName] = useState(initial?.name ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [activeScan, setActiveScan] = useState(initial?.activeScan ?? true);
  const [subdomains, setSubdomains] = useState<string[]>(
    initial?.subdomains && initial.subdomains.length > 0
      ? initial.subdomains
      : initial?.domain
        ? [defaultWildcard(initial.domain)]
        : []
  );

  // When domain changes, ensure at least one wildcard exists for fresh create
  useEffect(() => {
    if (mode === "create") {
      if (subdomains.length === 0) {
        const d = defaultWildcard(domain);
        setSubdomains(d ? [d] : [""]);
      } else if (subdomains.length === 1 && subdomains[0].startsWith("*.")) {
        // If first subdomain looks like wildcard for old domain, update it dynamically
        const d = defaultWildcard(domain);
        if (d && subdomains[0] !== d) {
          setSubdomains([d]);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const icon = useMemo(() => faviconUrl(domain), [domain]);

  function handleAddRow(index?: number) {
    const next = [...subdomains];
    const insertAt = typeof index === "number" ? index + 1 : next.length;
    next.splice(insertAt, 0, "");
    setSubdomains(next);
  }

  function handleRemoveRow(index: number) {
    const next = subdomains.filter((_, i) => i !== index);
    setSubdomains(next.length ? next : [""]);
  }

  function handleChangeRow(index: number, value: string) {
    const next = [...subdomains];
    next[index] = value;
    setSubdomains(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const normalizedDomain = normalizeDomain(domain);
    // Ensure we have at least one in-scope subdomain before sending (default: *.<domain>)
    let cleanedSubdomains = subdomains.map((s) => s.trim()).filter((s) => s.length > 0);
    if (cleanedSubdomains.length === 0) {
      const d = defaultWildcard(normalizedDomain || domain);
      if (d) cleanedSubdomains = [d];
    }
    const data: TargetData = {
      name: name.trim(),
      domain: normalizedDomain,
      subdomains: cleanedSubdomains,
      activeScan,
    };
    try {
      await onSubmit?.(data);
      // Clear form
      setName("");
      setDomain("");
      setActiveScan(true);
      setSubdomains([]);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "create" ? t("targets.dialog.createTitle") : t("targets.dialog.editTitle");
  const description =
    mode === "create" ? t("targets.dialog.createDesc") : t("targets.dialog.editDesc");

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-foreground">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {/* Target name and icon */}
          <div className="grid grid-cols-1 gap-5">
            <div className="grid gap-3">
              <Label htmlFor="target-name">{t("targets.form.companyName")}</Label>
              <div className="flex items-center gap-3">
                <div className="border-border bg-muted relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border">
                  {icon ? (
                    <img
                      src={icon}
                      alt="favicon"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                      <Globe2 className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <Input
                  id="target-name"
                  placeholder={t("targets.form.companyPlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Target domain */}
            <div className="grid gap-3">
              <Label htmlFor="target-domain">{t("targets.form.mainDomain")}</Label>
              <Input
                id="target-domain"
                placeholder="domain.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </div>

            {/* Target subdomains */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label>{t("targets.form.subdomains")}</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => handleAddRow()}>
                  <Plus className="mr-1 h-4 w-4" /> {t("targets.form.add")}
                </Button>
              </div>
              <div className="border-border rounded-lg border p-2">
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {subdomains.map((sd, idx) => (
                    <div key={idx} className="relative">
                      <Input
                        value={sd}
                        onChange={(e) => handleChangeRow(idx, e.target.value)}
                        placeholder={domain ? `*.${normalizeDomain(domain)}` : "*.domain.com"}
                        className="m-0.5 pr-20"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center gap-1">
                        <div className="pointer-events-auto flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghostNoHover"
                            className="text-muted-foreground hover:text-foreground h-7 w-7"
                            onClick={() => handleAddRow(idx)}
                            title={t("targets.form.addSubdomainTitle")}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghostNoHover"
                            className="text-muted-foreground hover:text-destructive h-7 w-7"
                            onClick={() => handleRemoveRow(idx)}
                            title={t("targets.form.removeSubdomainTitle")}
                            disabled={subdomains.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                <Trans
                  i18nKey="targets.form.defaultScope"
                  values={{ domain: normalizeDomain(domain) || "domain.com" }}
                  components={{ code: <code /> }}
                />
              </p>
            </div>

            {/* Enable scan */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="active-scan"
                className="size-5"
                checked={activeScan}
                onCheckedChange={(checked) => setActiveScan(checked === true)}
              />
              <Label htmlFor="active-scan" className="cursor-pointer">
                {t("targets.form.activeScan")}
              </Label>
            </div>
          </div>

          {/* Button actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              {t("targets.form.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !normalizeDomain(domain)}
              className="min-w-[120px]"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                </span>
              ) : mode === "create" ? (
                t("targets.form.add")
              ) : (
                t("targets.form.save")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
