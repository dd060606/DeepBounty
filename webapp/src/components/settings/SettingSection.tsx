import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function SettingSection({ title, description, children }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-foreground text-lg font-semibold">{title}</h3>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
      <Separator className="!mt-6" />
    </div>
  );
}
