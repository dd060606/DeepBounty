import type { ReactNode } from "react";

type Props = {
  label: string | ReactNode;
  description?: string;
  children: ReactNode;
};

export default function SettingItem({ label, description, children }: Props) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row">
      {/* Give the label column a fixed width so children sit next to it */}
      <div className="w-full flex-shrink-0 space-y-1 sm:w-xs">
        <label className="text-foreground text-sm font-medium">{label}</label>
        {description && <p className="text-muted-foreground text-xs">{description}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
