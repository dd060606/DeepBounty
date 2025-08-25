import { Button } from "@/components/ui/button";
import TargetDialog from "@/components/dialogs/target-dialog";

export default function Targets() {
  return (
    <div>
      <TargetDialog
        mode="create"
        trigger={<Button>Add target</Button>}
        initial={{
          name: "Test",
          domain: "test.com",
          subdomains: [],
          activeScan: true,
        }}
        onSubmit={async (data) => {
          document.querySelector("#data")!.textContent = JSON.stringify(data, null, 2);
        }}
      />
      <p id="data"></p>
    </div>
  );
}
