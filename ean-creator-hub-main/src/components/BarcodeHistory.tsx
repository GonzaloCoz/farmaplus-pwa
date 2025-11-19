import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Trash2 } from "lucide-react";
import { BarcodeHistoryItem } from "@/hooks/use-barcode-history";

interface BarcodeHistoryProps {
  history: BarcodeHistoryItem[];
  onSelectCode: (code: string) => void;
  onClearHistory: () => void;
}

export const BarcodeHistory = ({
  history,
  onSelectCode,
  onClearHistory,
}: BarcodeHistoryProps) => {
  if (history.length === 0) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Últimos códigos</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearHistory}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {history.map((item, index) => (
          <button
            key={`${item.code}-${item.timestamp}`}
            onClick={() => onSelectCode(item.code)}
            className="w-full text-left p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-medium text-foreground">
                {item.code}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(item.timestamp).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
};
