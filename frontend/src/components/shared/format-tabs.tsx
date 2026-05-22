import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Mic, Video } from "lucide-react"

export type FormatTabValue = "spaces" | "livestreams"

interface FormatTabsProps {
  value: FormatTabValue
  onValueChange: (value: FormatTabValue) => void
}

const TABS: { value: FormatTabValue; label: string; icon: typeof Mic }[] = [
  { value: "spaces", label: "Live Spaces", icon: Mic },
  { value: "livestreams", label: "Livestreams", icon: Video },
]

export function FormatTabs({ value, onValueChange }: FormatTabsProps) {
  return (
    <div className="w-full flex justify-center px-0">
      <div
        className={cn(
          "w-[calc(100%-32px)] sm:max-w-[400px] sm:w-full",
        )}
      >
        <Tabs value={value} onValueChange={(v) => onValueChange(v as FormatTabValue)}>
          <TabsList className="w-full h-auto p-1 rounded-xl gap-0.5 bg-muted/80">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2",
                    "py-2.5 px-4 rounded-lg",
                    "text-[11px] font-black uppercase tracking-[0.12em]",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",
                    "transition-all duration-200",
                  )}
                >
                  <Icon size={14} className="shrink-0" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
