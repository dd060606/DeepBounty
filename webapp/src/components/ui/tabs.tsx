import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = React.useState<{
    left: number;
    width: number;
    opacity: number;
  }>({ left: 0, width: 0, opacity: 0 });

  const updateIndicator = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>("[data-state='active']");
    if (!active) return;
    const listRect = list.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    const left = rect.left - listRect.left + list.scrollLeft;
    const width = rect.width;
    setIndicator({ left, width, opacity: 1 });
  }, []);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Update on mount
    updateIndicator();
    // Observe size changes (list + triggers)
    const ro = new ResizeObserver(() => updateIndicator());
    ro.observe(list);
    list
      .querySelectorAll<HTMLElement>("[data-slot='tabs-trigger']")
      .forEach((el) => ro.observe(el));
    // Observe attribute changes (active state)
    const mo = new MutationObserver(() => updateIndicator());
    mo.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-state", "class", "style"],
    });
    // Listen to window resize
    const onResize = () => updateIndicator();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      mo.disconnect();
    };
  }, [updateIndicator]);

  return (
    <TabsPrimitive.List
      ref={listRef as React.RefObject<HTMLDivElement>}
      data-slot="tabs-list"
      className={cn(
        "text-muted-foreground relative inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...props}
    >
      {/* Moving underline */}
      <span
        aria-hidden
        className="bg-primary pointer-events-none absolute bottom-0 h-[2px] rounded-full transition-all duration-300 ease-out"
        style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
      />
      {props.children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-4 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
