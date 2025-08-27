import { Button } from "@/components/ui/button";
import TargetDialog from "@/components/dialogs/target-dialog";
import type { TargetData } from "@/utils/types";
import ApiClient from "@/utils/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Targets() {
  const { t } = useTranslation();
  async function addNewTarget(data: TargetData) {
    try {
      await ApiClient.post("/targets", {
        name: data.name,
        domain: data.domain,
        activeScan: data.activeScan,
      });
    } catch (error) {
      toast.error(t("targets.errors.newTarget"));
      console.error("Error adding new target:", error);
    }
  }
  return (
    <div>
      <TargetDialog mode="create" trigger={<Button>Add target</Button>} onSubmit={addNewTarget} />
    </div>
  );
}
