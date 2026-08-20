import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/types";

interface LanguageBadgeProps {
  lang: Language;
  className?: string;
}

const langConfig: Record<Language, { label: string; flag: string }> = {
  fr: { label: "French", flag: "FR" },
  nl: { label: "Dutch", flag: "NL" },
  en: { label: "English", flag: "EN" },
};

export function LanguageBadge({ lang, className }: LanguageBadgeProps) {
  const config = langConfig[lang];
  if (!config) return null;
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1 font-mono text-xs", className)}
    >
      <span className="font-bold">{config.flag}</span>
      <span className="text-muted-foreground">{config.label}</span>
    </Badge>
  );
}
