import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TasksTab from "./metrics/TasksTab";
import EventsTab from "./metrics/EventsTab";

export default function Metrics() {
  const { t } = useTranslation();
  // Time window in days, shared across both tabs
  const [days, setDays] = useState("7");

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-xl font-semibold">{t("analytics.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{t("analytics.range.label")}</span>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t("analytics.range.last24h")}</SelectItem>
              <SelectItem value="7">{t("analytics.range.last7d")}</SelectItem>
              <SelectItem value="30">{t("analytics.range.last30d")}</SelectItem>
              <SelectItem value="90">{t("analytics.range.last90d")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="tasks">{t("analytics.tabs.tasks")}</TabsTrigger>
          <TabsTrigger value="events">{t("analytics.tabs.events")}</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <TasksTab days={Number(days)} />
        </TabsContent>

        <TabsContent value="events">
          <EventsTab days={Number(days)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
