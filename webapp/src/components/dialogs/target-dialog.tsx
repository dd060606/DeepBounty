import { useMemo, useState } from "react";
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
import {
  defaultWildcard,
  faviconUrl,
  normalizeDomain,
  isValidDomain,
  isValidSubdomainEntry,
} from "@/utils/domains";
import type { TargetData } from "@/utils/types";

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
  const [touched, setTouched] = useState<{
    name?: boolean;
    domain?: boolean;
    subs?: Record<number, boolean>;
  }>({});

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

  // Remove auto-fill behavior; keep user control. Placeholder will indicate default.

  const icon = useMemo(() => faviconUrl(domain), [domain]);

  // Validation helpers
  const nameError = !name.trim() ? t("targets.form.errors.nameRequired") : null;
  const domainRequired = !normalizeDomain(domain);
  const domainInvalid = !domainRequired && !isValidDomain(domain);
  const domainError = domainRequired
    ? t("targets.form.errors.domainRequired")
    : domainInvalid
      ? t("targets.form.errors.domainInvalid")
      : null;
  // Subdomain validation: flag invalid non-empty rows
  const subdomainErrors: Record<number, string> = {};
  subdomains.forEach((sd, idx) => {
    const v = sd.trim();
    if (v && !isValidSubdomainEntry(v)) {
      subdomainErrors[idx] = t("targets.form.errors.subdomainInvalid");
    }
  });
  const hasErrors = Boolean(nameError || domainError || Object.keys(subdomainErrors).length > 0);

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
    // Mark fields as touched to show errors if any
    setTouched((s) => ({
      name: true,
      domain: true,
      subs: {
        ...(s.subs || {}),
        ...Object.fromEntries(subdomains.map((_, i) => [i, true])),
      },
    }));
    if (hasErrors) return;
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
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "create" ? t("targets.dialog.createTitle") : t("targets.dialog.editTitle");
  const description =
    mode === "create" ? t("targets.dialog.createDesc") : t("targets.dialog.editDesc");

  function initFromInitial() {
    // Initialize form state from initial values
    setName(initial?.name ?? "");
    setDomain(initial?.domain ?? "");
    setActiveScan(initial?.activeScan ?? true);
    const subs = initial?.subdomains && initial.subdomains.length > 0 ? initial.subdomains : [""];
    setSubdomains(subs);
    setTouched({});
    setSaving(false);
  }

  function resetForm() {
    // Clear form state
    setName("");
    setDomain("");
    setActiveScan(true);
    setSubdomains([]);
    setTouched({});
    setSaving(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      initFromInitial();
    } else {
      resetForm();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader>
            <DialogTitle className="text-foreground">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {/* Target name and icon */}
          <div className="grid grid-cols-1 gap-5">
            <div className="grid gap-2">
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
                  onBlur={() => setTouched((s) => ({ ...s, name: true }))}
                  required
                />
              </div>
              {touched.name && nameError ? (
                <p className="text-destructive text-xs font-medium" role="alert">
                  {nameError}
                </p>
              ) : null}
            </div>

            {/* Target domain */}
            <div className="grid gap-2">
              <Label htmlFor="target-domain">{t("targets.form.mainDomain")}</Label>
              <Input
                id="target-domain"
                placeholder="example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onBlur={() => setTouched((s) => ({ ...s, domain: true }))}
                aria-invalid={touched.domain && Boolean(domainError)}
                required
              />
              {touched.domain && domainError ? (
                <p className="text-destructive text-xs font-medium" role="alert">
                  {domainError}
                </p>
              ) : null}
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
                  {/* Subdomain list */}
                  {subdomains.map((sd, idx) => {
                    const err = subdomainErrors[idx];
                    const isTouched = touched.subs?.[idx];
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="relative">
                          {/* Subdomain input */}
                          <Input
                            value={sd}
                            onChange={(e) => handleChangeRow(idx, e.target.value)}
                            onBlur={() =>
                              setTouched((s) => ({
                                ...s,
                                subs: { ...(s.subs || {}), [idx]: true },
                              }))
                            }
                            placeholder={domain ? `*.${normalizeDomain(domain)}` : "*.example.com"}
                            className="m-0.5 pr-20"
                            aria-invalid={Boolean(isTouched && err)}
                          />
                          {/* Subdomain actions */}
                          <div className="pointer-events-none absolute top-0 right-1 flex h-9 items-center gap-1">
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
                        {/* Subdomain error message */}
                        {isTouched && err ? (
                          <p className="text-destructive text-xs font-medium" role="alert">
                            {err}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
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
            <Button type="submit" disabled={saving || hasErrors} className="min-w-[120px]">
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
