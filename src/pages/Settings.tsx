import { useState, useEffect } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

import { Smartphone, Wifi, Trash2, Info, Cloud, Database, Bell } from "lucide-react";
// import { toast } from "sonner"; // Removed
import { clearAllData, clearProducts, addProducts, Product } from "@/services/preCountDB";
import { SyncStatusBottomSheet } from "@/components/SyncStatusBottomSheet";
import { Input } from "@/components/ui/input";
import * as XLSX from 'xlsx';

import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";
import { NotificationPositionSelector } from "@/components/settings/NotificationPositionSelector";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { notify } from "@/lib/notifications";
import { UserManagement } from "@/components/settings/UserManagement";
import { hasPermission } from "@/config/permissions";

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { preferences, setPosition, setReminderType } = useNotificationPreferences();

  // ... (state hooks remain)
  const [haptics, setHaptics] = useState(true);
  const [sounds, setSounds] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [scannerSensitivity, setScannerSensitivity] = useState([50]);
  const [isImporting, setIsImporting] = useState(false);

  // ... (handlers remain - keep existing implementation)
  const handleClearCache = async () => {
    // ...
    if (confirm("¿Estás seguro de que deseas borrar todos los datos locales? Esta acción no se puede deshacer.")) {
      try {
        await clearAllData();
        notify.success("Operación exitosa", "Datos locales eliminados correctamente");
        window.location.reload();
      } catch (e) {
        notify.error("Error", "Error al eliminar datos");
      }
    }
  };

  const handleImportProducts = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // ... (keep existing implementation)
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: "A" });
      const products: Product[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const rawName = row["D"];
        const rawLab = row["O"];
        const rawEans = row["Q"];

        if (!rawName || !rawEans) continue;

        const name = String(rawName).trim();
        const laboratory = rawLab ? String(rawLab).trim() : undefined;
        const eanString = String(rawEans).trim();

        const eanList = eanString.split('-').map(e => e.trim()).filter(e => e.length > 0);

        eanList.forEach(ean => {
          products.push({
            ean: ean,
            name: name,
            cost: 0,
            salePrice: 0,
            laboratory: laboratory,
            category: '',
            stock: 0
          });
        });
      }

      if (products.length === 0) {
        notify.error("Error", "No se encontraron productos válidos. Verifica las columnas (D=Producto, Q=EAN).");
        return;
      }

      if (confirm(`Se encontraron ${products.length} códigos EAN (de ${jsonData.length - 1} filas). ¿Deseas reemplazar la base de datos actual?`)) {
        await clearProducts();
        await addProducts(products);
        notify.success("Operación exitosa", `${products.length} productos importados correctamente.`);
      }
      event.target.value = '';
    } catch (error) {
      console.error("Error importing products:", error);
      notify.error("Error", "Error al importar el archivo. Asegúrate de que sea un Excel válido.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <PageLayout>


      <div className="grid gap-6">
        {/* Notificaciones */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle>Notificaciones</CardTitle>
            </div>
            <CardDescription>Personaliza cómo y dónde aparecen las notificaciones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Reminder Type */}
            <div className="space-y-4">
              <div>
                <Label className="text-base">Recordatorios</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Estas son notificaciones para recordarte actividad que has perdido o citas próximas.
                </p>
              </div>

              <RadioGroup value={preferences.reminderType} onValueChange={(value) => setReminderType(value as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="center-only" id="center-only" />
                  <Label htmlFor="center-only" className="font-normal cursor-pointer">
                    Mostrar nuevos recordatorios en el centro de notificaciones pero no como banners.
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal cursor-pointer">
                    Notificarme para todos los recordatorios
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none" className="font-normal cursor-pointer">
                    No notificarme.
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Position Selector */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-base">Posición de notificación</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => notify.info("Notificación de prueba", "Esta es una vista previa de cómo aparecerán tus notificaciones.")}
                >
                  Probar
                </Button>
              </div>
              <NotificationPositionSelector
                value={preferences.position}
                onChange={setPosition}
              />
            </div>
          </CardContent>
        </Card>

        {/* Personalización */}


        {/* Inventario y Escáner */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              <CardTitle>Inventario y Escáner</CardTitle>
            </div>
            <CardDescription>Configuración del lector de código de barras y feedback.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Vibración (Haptics)</Label>
                <p className="text-sm text-muted-foreground">
                  Vibrar al escanear correctamente un producto.
                </p>
              </div>
              <Switch checked={haptics} onCheckedChange={setHaptics} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Sonidos</Label>
                <p className="text-sm text-muted-foreground">
                  Reproducir sonido de confirmación.
                </p>
              </div>
              <Switch checked={sounds} onCheckedChange={setSounds} />
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex justify-between">
                <Label>Sensibilidad del Escáner</Label>
                <span className="text-sm text-muted-foreground">{scannerSensitivity}%</span>
              </div>
              <Slider
                value={scannerSensitivity}
                onValueChange={setScannerSensitivity}
                max={100}
                step={10}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Sincronización */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary" />
              <CardTitle>Sincronización</CardTitle>
            </div>
            <CardDescription>Gestión de datos offline y subida.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Sincronización Automática</Label>
                <p className="text-sm text-muted-foreground">
                  Subir cambios automáticamente cuando haya conexión.
                </p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>

            <div className="pt-2">
              <SyncStatusBottomSheet>
                <Button variant="outline" className="w-full justify-start">
                  <Cloud className="mr-2 h-4 w-4" />
                  Abrir Centro de Sincronización
                </Button>
              </SyncStatusBottomSheet>
            </div>
          </CardContent>
        </Card>

        {/* Base de Datos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              <CardTitle>Base de Datos de Productos</CardTitle>
            </div>
            <CardDescription>Gestiona el catálogo de productos local.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                <div>
                  <h3 className="font-medium mb-1">Importar Productos desde Excel</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Actualiza la base de datos con un archivo .xlsx. El archivo debe tener columnas "EAN" y "Descripcion".
                  </p>

                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleImportProducts}
                      disabled={isImporting}
                      className="cursor-pointer"
                    />
                  </div>
                  {isImporting && (
                    <p className="text-sm text-muted-foreground mt-2 animate-pulse">
                      Procesando archivo...
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={handleClearCache}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Borrar datos locales y caché
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Utiliza esto si experimentas problemas con la aplicación. Se borrarán los datos no sincronizados.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Administración (Solo para Admins) */}
        {user?.role === 'admin' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                <CardTitle>Administración</CardTitle>
              </div>
              <CardDescription>Gestión de sucursales y configuraciones globales (solo administradores).</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/admin/branches')}
              >
                Administrar Sucursales
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Únicamente para Super User (gcoz) */}
        {hasPermission(user, 'MANAGE_USERS') && (
          <UserManagement />
        )}

        {/* Sistema */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              <CardTitle>Sistema</CardTitle>
            </div>
            <CardDescription>Información de la versión y mantenimiento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="space-y-1">
                <p className="font-medium">Versión de la App</p>
                <p className="text-sm text-muted-foreground">v1.2.0 (Build 2025.11.24)</p>
              </div>
              <Button variant="outline" size="sm" disabled>
                Actualizada
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
