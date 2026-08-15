import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FindingType } from "@/lib/types";
import { AlertCircle, Clock, FileQuestion, GitCompare, TriangleAlert } from "lucide-react";

interface FindingBadgeProps {
  type: FindingType;
  className?: string;
}

const findingConfig: Record<
  FindingType,
  { label: string; variant: string; icon: typeof AlertCircle }
> = {
  incorrect: {
    label: "Incorrect",
    variant: "bg-destructive/15 text-destructive border-destructive/30",
    icon: AlertCircle,
  },
  outdated: {
    label: "Outdated",
    variant: "bg-chart-3/15 text-chart-3 border-chart-3/30",
    icon: Clock,
  },
  ungrounded: {
    label: "Ungrounded",
    variant: "bg-chart-4/15 text-chart-4 border-chart-4/30",
    icon: FileQuestion,
  },
  drift: {
    label: "FR/NL Drift",
    variant: "bg-chart-1/15 text-chart-1 border-chart-1/30",
    icon: GitCompare,
  },
  instability: {
    label: "Instability",
    variant: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    icon: TriangleAlert,
  },
};

export function FindingBadge({ type, className }: FindingBadgeProps) {
  const config = findingConfig[type];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border", config.variant, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
