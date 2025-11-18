import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type Props = {
  value: string;
  onRegenerate?: () => void | Promise<void>;
  regenerating?: boolean;
};

export default function SecretField({ value, onRegenerate, regenerating }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  function copyToClipboard() {
    navigator.clipboard.writeText(value);
    toast.success(t("settings.general.secretCopied"));
  }

  return (
    <div className="flex w-xs items-center gap-2 sm:w-sm">
      <div className="relative flex-1">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          readOnly
          className="pr-10 font-mono text-xs"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={copyToClipboard}
        title={t("settings.general.copy")}
      >
        <Copy className="size-4" />
      </Button>
      {onRegenerate && (
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={onRegenerate}
          disabled={regenerating}
          title={t("settings.general.regenerate")}
        >
          <RefreshCw className={`size-4 ${regenerating ? "animate-spin" : ""}`} />
        </Button>
      )}
    </div>
  );
}
