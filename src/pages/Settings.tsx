import { Card } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Ajustes y preferencias de la aplicación.
        </p>
      </div>
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <SettingsIcon className="mx-auto h-16 w-16 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium">Página en Construcción</h3>
        <p className="mt-1 text-sm text-muted-foreground">Esta sección estará disponible próximamente.</p>
      </Card>
    </div>
  );
}