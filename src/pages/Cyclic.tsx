import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function Cyclic() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-foreground mb-2">Inventarios Cíclicos</h1>
      <p className="text-muted-foreground mb-6">
        Análisis y seguimiento de inventarios por ciclos.
      </p>
      <Card className="p-12 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">Página en Construcción</h3>
        <p className="mt-1 text-sm text-muted-foreground">Esta sección estará disponible próximamente.</p>
      </Card>
    </div>
  );
}