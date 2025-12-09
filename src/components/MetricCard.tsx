import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  changeType = "neutral",
  icon: Icon,
}: MetricCardProps) {
  const changeColors = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {Icon && (
          <div className="p-2 bg-muted rounded-lg">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <p className="text-3xl font-bold text-foreground">{value}</p>
        
        <div className="flex items-center gap-2 text-sm">
          {subtitle && (
            <span className="text-muted-foreground">{subtitle}</span>
          )}
          {change && (
            <span className={changeColors[changeType]}>
              {changeType === "positive" && "↑ "}
              {changeType === "negative" && "↓ "}
              {change}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
