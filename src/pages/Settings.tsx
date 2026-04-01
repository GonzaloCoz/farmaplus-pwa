import { useState, useEffect, useCallback, lazy, Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

import { Smartphone, Cloud as Wifi, TrashBinMinimalistic as Trash2, InfoCircle as Info, Cloud, Database, Bell, Shield, User as UserIcon, UsersGroupTwoRounded as Users } from "@solar-icons/react";
import { clearProducts, addProducts, Product } from "@/services/productService";
import { SyncStatusBottomSheet } from "@/components/SyncStatusBottomSheet";
import { Input } from "@/components/ui/input";
import * as XLSX from 'xlsx';

import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";
import { NotificationPositionSelector } from "@/components/settings/NotificationPositionSelector";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { notify } from "@/lib/notifications";
import { hasPermission } from "@/config/permissions";
import { supabase } from "@/integrations/supabase/client";
import { BRANCH_NAMES } from "@/config/users";
import { useTheme } from "@/hooks/useTheme";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, BookOpen, Users2, DownloadCloud, PenTool } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAppVersion, CURRENT_APP_VERSION } from '@/hooks/useAppVersion';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// AdminAudit removed - moved to Reports.tsx
// ... other imports

// Consolidated settings interface
interface AppSettings {
  haptics: boolean;
  sounds: boolean;
  autoSync: boolean;
  scannerSensitivity: number;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const isAdmin = user?.role === 'admin';
  const { preferences, setPosition, setReminderType } = useNotificationPreferences();
  const { themeMode, setThemeMode } = useTheme();
  const queryClient = useQueryClient();

  // Consolidated settings state
  const [settings, setSettings] = useState<AppSettings>({
    haptics: true,
    sounds: false,
    autoSync: true,
    scannerSensitivity: 50
  });

  const [isImporting, setIsImporting] = useState(false);
  const [isImportingLabs, setIsImportingLabs] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isUpdatingGoals, setIsUpdatingGoals] = useState(false);
  const isGcoz = user?.username.toLowerCase() === 'gcoz';

  // App Version state
  const { currentVersion, latestVersion } = useAppVersion();
  const [isPublishingVersion, setIsPublishingVersion] = useState(false);
  const [newVersionObj, setNewVersionObj] = useState({ version: '', notes: '' });
  const [selectedBranchImport, setSelectedBranchImport] = useState<string>("");

  // Add auto-generated version prefix on load
  useEffect(() => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getDate().toString().padStart(2, '0')}`;
    setNewVersionObj(prev => ({ ...prev, version: `v1.2.x (Build ${dateStr})` }));
  }, []);

  // Optimized update function
  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleImportLaboratories = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm("¿Deseas importar las asignaciones de laboratorios? Esto limpiará y actualizará la tabla branch_laboratories.")) {
      event.target.value = '';
      return;
    }

    setIsImportingLabs(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      // Create sheet name map (case-insensitive)
      const sheetMap = new Map<string, string>();
      workbook.SheetNames.forEach(s => sheetMap.set(s.toLowerCase().trim(), s));

      let totalLabs = 0;
      const labAssignments: Array<{ branch: string; lab: string; category: string }> = [];

      // Process each branch in BRANCH_NAMES
      for (const branchName of BRANCH_NAMES) {
        const nBranch = branchName.toLowerCase().trim();
        let sheetName = sheetMap.get(nBranch);

        // Fallback: Try matching "San Isidro I" with "San Isidro" or vice versa
        if (!sheetName) {
          // Try finding a sheet that is contained in the branch name or vice versa
          for (const [sKey, sName] of sheetMap.entries()) {
            // Example: Branch "San Isidro I" (nBranch='san isidro i') contains Sheet "San Isidro" (sKey='san isidro')
            // OR Sheet "Belgrano V" contains Branch "Belgrano" (dangerous? No, usually specific to general)

            // Safer Strategy:
            // 1. Check if Branch Name starts with Sheet Name (Sheet: "San Isidro", Branch: "San Isidro I")
            if (nBranch.startsWith(sKey) && sKey.length > 3) {
              sheetName = sName;
              break;
            }
            // 2. Check if Sheet Name starts with Branch Name (Sheet: "Belgrano V1", Branch: "Belgrano") -- wait, strict
          }
        }

        if (!sheetName) {
          // console.warn(`Skipping branch ${branchName}: No matching sheet found.`);
          continue;
        }

        // Parse labs from sheet
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];
        if (jsonData.length < 2) continue;

        const headers = jsonData[1];

        for (let c = 0; c < headers.length; c++) {
          const category = String(headers[c] || '').trim();
          if (!category) continue;

          for (let r = 2; r < jsonData.length; r++) {
            const row = jsonData[r];
            if (row && row[c]) {
              const labName = String(row[c]).trim();
              if (labName.length > 0) {
                labAssignments.push({
                  branch: branchName, // Utilize the SYSTEM branch name "San Isidro I"
                  lab: labName.toUpperCase(),
                  category: category.toUpperCase()
                });
                totalLabs++;
              }
            }
          }
        }
      }

      if (labAssignments.length === 0) {
        notify.error("Error", "No se encontraron laboratorios en el archivo.");
        event.target.value = '';
        return;
      }

      // 1. Build list of operations
      const branchesProcessed = new Set<string>();
      const validLabIds = new Map<string, Set<string>>(); // Branch -> Set of "Laboratory|Category"

      // Deduplicate assignments (in case Excel has duplicates)
      const uniqueAssignments = new Map<string, typeof labAssignments[0]>();
      labAssignments.forEach(a => {
        const key = `${a.branch}|${a.lab}|${a.category}`;
        if (!uniqueAssignments.has(key)) {
          uniqueAssignments.set(key, a);
        }

        // Track valid IDs for cleanup
        branchesProcessed.add(a.branch);
        if (!validLabIds.has(a.branch)) {
          validLabIds.set(a.branch, new Set());
        }
        // We track "Laboratory|Category" as the composite key for validity
        validLabIds.get(a.branch)?.add(`${a.lab}|${a.category}`);
      });

      // 2. Insert/Update new assignments using UPSERT (Non-destructive to progress)
      const insertData = Array.from(uniqueAssignments.values()).map(a => ({
        branch_name: a.branch,
        laboratory: a.lab,
        category: a.category,
        // Status might be reset to default or kept?
        // If we want to ensure visibility, defaulting to 'pending' is safe for configuration updates.
        status: 'pending' as const,
        // No updated_at col
      }));

      // Insert in chunks
      const chunkSize = 500;
      let insertedCount = 0;

      for (let i = 0; i < insertData.length; i += chunkSize) {
        const chunk = insertData.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('branch_laboratories')
          .upsert(chunk, {
            onConflict: 'branch_name,laboratory,category',
            ignoreDuplicates: false
          });

        if (error) throw new Error(`Error insertando chunk ${i}: ${error.message}`);
        insertedCount += chunk.length;
      }

      // 3. CLEANUP ORPHANS (The "Exact Sync" Step)
      // For each branch we touched, delete rows that match the branch but constitute an "Orphan" (not in our valid set)
      let deletedCount = 0;

      for (const branch of branchesProcessed) {
        // We need to fetch ALL labs for this branch to compare
        // (Doing it via SQL delete directly with NOT IN might be complex due to composite key)
        // Simplest strategy: Fetch IDs for this branch, filter locally, delete by ID.

        const { data: existingLabs, error: fetchError } = await supabase
          .from('branch_laboratories')
          .select('id, laboratory, category')
          .eq('branch_name', branch);

        if (fetchError) throw new Error(`Error fetching labs for cleanup: ${fetchError.message}`);

        const validSet = validLabIds.get(branch);
        const idsToDelete: string[] = [];

        existingLabs?.forEach(row => {
          const key = `${row.laboratory}|${row.category}`;
          if (!validSet?.has(key)) {
            idsToDelete.push(row.id);
          }
        });

        if (idsToDelete.length > 0) {
          // Delete in batches if necessary
          const { error: deleteError } = await supabase
            .from('branch_laboratories')
            .delete()
            .in('id', idsToDelete);

          if (deleteError) throw new Error(`Error deleting orphans: ${deleteError.message}`);
          deletedCount += idsToDelete.length;
        }
      }

      notify.success(
        "Sincronización Exacta Completada",
        `${insertedCount} laboratorios asegurados. ${deletedCount} laboratorios obsoletos eliminados de las sucursales procesadas.`
      );
      toast.success('Laboratorios y categorías importados exitosamente');
      event.target.value = '';
    } catch (error: any) {
      console.error("Import error:", error);
      notify.error("Error", `No se pudo completar la importación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      toast.error('Error al importar', { description: error.message });
      event.target.value = '';
    } finally {
      setIsImportingLabs(false);
    }
  };

  const handleImportIndividualLaboratories = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedBranchImport) {
      notify.error("Error", "Por favor selecciona una sucursal primero.");
      event.target.value = '';
      return;
    }

    if (!confirm(`¿Deseas importar las asignaciones para ${selectedBranchImport}? Esto actualizará sus laboratorios basándose en el archivo maestro.`)) {
      event.target.value = '';
      return;
    }

    setIsImportingLabs(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      const sheetMap = new Map<string, string>();
      workbook.SheetNames.forEach(s => sheetMap.set(s.toLowerCase().trim(), s));

      const selectedBranchUpper = selectedBranchImport.toUpperCase().trim();
      const nBranchSearch = selectedBranchImport.toLowerCase().trim();
      let sheetName = sheetMap.get(nBranchSearch);

      // --- NEW STRICT MATCHING LOGIC ---
      if (!sheetName) {
        const simplifiedBranch = nBranchSearch.replace(/\s+/g, '');
        for (const [sKey, sName] of sheetMap.entries()) {
          const simplifiedKey = sKey.replace(/\s+/g, '');
          if (simplifiedKey === simplifiedBranch) {
            sheetName = sName;
            break;
          }
        }
      }

      if (!sheetName) {
        throw new Error(`No se encontró una hoja coincidente para "${selectedBranchImport}" en el archivo Excel. Verifica que el nombre de la pestaña coincida.`);
      }

      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];
      if (jsonData.length < 2) throw new Error("La hoja seleccionada no tiene datos válidos.");

      const headers = jsonData[1];
      const excelLabsSet = new Set<string>(); // composite keys: "LAB|CAT"
      const excelLabNamesOnlySet = new Set<string>(); // unique names: "LAB"
      const newAssignments: any[] = [];

      for (let c = 0; c < headers.length; c++) {
        const category = String(headers[c] || '').trim().toUpperCase();
        if (!category) continue;

        for (let r = 2; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (row && row[c]) {
            const labName = String(row[c]).trim().toUpperCase();
            if (labName.length > 0) {
              const key = `${labName}|${category}`;
              excelLabNamesOnlySet.add(labName);
              if (!excelLabsSet.has(key)) {
                excelLabsSet.add(key);
                newAssignments.push({
                   branch_name: selectedBranchUpper,
                   laboratory: labName,
                   category: category,
                   status: 'pending',
                   progress_percentage: 0
                });
              }
            }
          }
        }
      }

      // 1. Fetch existing labs for this branch (WITH PROGRESS)
      const { data: existingLabs, error: fetchError } = await supabase
        .from('branch_laboratories')
        .select('id, laboratory, category, progress_percentage')
        .eq('branch_name', selectedBranchUpper);

      if (fetchError) throw fetchError;

      // 2. Identify Orphans with DATA GUARD & MULTI-RUBRO PROTECTION
      const protectedLabsProgress: string[] = [];
      const protectedLabsMultiRubro: string[] = [];
      
      const idsToDelete = existingLabs
        ?.filter(row => {
          const labName = row.laboratory.toUpperCase();
          const category = row.category.toUpperCase();
          const key = `${labName}|${category}`;
          
          const isMissingInExcelForKey = !excelLabsSet.has(key);
          const hasProgress = (row.progress_percentage || 0) > 0;
          const existsInExcelSomewhere = excelLabNamesOnlySet.has(labName);
          
          // Protection 1: Progress
          if (isMissingInExcelForKey && hasProgress) {
            protectedLabsProgress.push(labName);
            return false; // KEEP
          }
          
          // Protection 2: Multi-Rubro ("esos no los toques")
          // If the lab name exists in ANY category in Excel, we don't delete this category in DB
          if (isMissingInExcelForKey && existsInExcelSomewhere) {
            protectedLabsMultiRubro.push(`${labName} (${category})`);
            return false; // KEEP
          }
          
          return isMissingInExcelForKey; // Delete ONLY if missing from Excel completely AND has no progress
        })
        .map(row => row.id) || [];

      // 3. Execute Upsert
      if (newAssignments.length > 0) {
        const { error: upsError } = await (supabase as any)
          .from('branch_laboratories')
          .upsert(newAssignments, { onConflict: 'branch_name,laboratory,category' });
        
        if (upsError) {
          console.error("Postgres Error 23505/Conflict:", upsError);
          throw new Error(`Error de Sincronización: Probablemente existen laboratorios duplicados. Por favor ejecuta el Script de Reparación en Supabase.`);
        }
      }

      // 4. Execute Batch Deletion (50 IDs at a time to prevent CORS/URL Length errors)
      if (idsToDelete.length > 0) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
          const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
          const { error: delError } = await supabase
            .from('branch_laboratories')
            .delete()
            .in('id', chunk);
          
          if (delError) {
            console.error("Batch delete error:", delError);
            throw delError;
          }
        }
      }

      notify.success(
        "Sincronización Exitosa",
        `Sucursal: ${selectedBranchImport}\n\n` +
        `✅ ${newAssignments.length} laboratorios actualizados.\n` +
        `🗑️ ${idsToDelete.length} laboratorios obsoletos eliminados.\n` +
        (protectedLabsProgress.length > 0 ? `🛡️ ${protectedLabsProgress.length} protegidos por tener progreso.\n` : "") +
        (protectedLabsMultiRubro.length > 0 ? `📂 ${protectedLabsMultiRubro.length} protegidos por pertenecer a varios rubros.` : "")
      );
      
      toast.success('Actualización de sucursal completada');
      event.target.value = '';
    } catch (error: any) {
      console.error("Individual import error:", error);
      notify.error("Error", error.message || 'Error al procesar la sucursal.');
      event.target.value = '';
    } finally {
      setIsImportingLabs(false);
    }
  };

  // ... (handlers remain - keep existing implementation)
  const handleClearCache = async () => {
    if (confirm("¿Estás seguro de que deseas borrar la base de datos de productos? Esta acción no se puede deshacer.")) {
      try {
        await clearProducts();
        notify.success("Operación exitosa", "Base de datos de productos eliminada correctamente");
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
      const headerRow: any = jsonData[0] || {};

      // Encontrar índices de columnas por nombre
      let colId = "A";
      let colName = "B";
      let colEan = "C";

      Object.entries(headerRow).forEach(([key, value]) => {
        const val = String(value).toLowerCase().trim();
        if (val.includes("idproducto")) colId = key;
        if (val === "producto" || val === "nombre") colName = key;
        if (val.includes("barcode") || val.includes("codigo") || val.includes("ean")) colEan = key;
      });

      for (let i = 1; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        const rawId = row[colId];
        const rawName = row[colName];
        const rawEans = row[colEan];

        if (!rawName || !rawEans) continue;

        const idProducto = rawId ? String(rawId).trim() : undefined;
        const name = String(rawName).trim();
        const eanString = String(rawEans).trim();

        const eanList = eanString.split(/[-,\s;]+/).map(e => e.trim()).filter(e => e.length > 0);

        eanList.forEach(ean => {
          products.push({
            ean: ean,
            name: name,
            cost: 0,
            salePrice: 0,
            laboratory: undefined,
            category: '',
            stock: 0,
            id_producto: idProducto
          });
        });
      }

      if (products.length === 0) {
        notify.error("Error", "No se encontraron productos válidos. Verifica las columnas (IDProducto, Producto, Barcodes).");
        return;
      }

      // Deduplicar productos por EAN para evitar el error "ON CONFLICT DO UPDATE command cannot affect row a second time"
      const uniqueProductsMap = new Map<string, Product>();
      products.forEach(p => uniqueProductsMap.set(p.ean, p));
      const uniqueProducts = Array.from(uniqueProductsMap.values());

      if (confirm(`Se encontraron ${uniqueProducts.length} códigos EAN únicos (de ${jsonData.length - 1} filas). ¿Deseas reemplazar la base de datos actual?`)) {
        await clearProducts();
        await addProducts(uniqueProducts);
        notify.success("Operación exitosa", `${uniqueProducts.length} productos con IDProducto importados correctamente.`);
      }
      event.target.value = '';
    } catch (error: any) {
      console.error("Error importing products:", error);
      const errorDetail = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      notify.error("Error", `Error al importar: ${errorDetail.substring(0, 100)}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handlePurgeAll = async () => {
    setIsPurging(true);
    try {
      await cyclicInventoryService.purgeAllInventoryData();
      notify.success("Sistema Limpiado", "Todos los datos de inventario han sido borrados.");
    } catch (error) {
      notify.error("Error al limpiar", "No se pudo realizar la purga masiva.");
      console.error(error);
    } finally {
      setIsPurging(false);
    }
  };

  const handlePublishVersion = async () => {
    if (!newVersionObj.version.trim()) {
      toast.error('Ingresa un número de versión válido');
      return;
    }

    setIsPublishingVersion(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from('app_versions')
        .insert({
          version: newVersionObj.version.trim(),
          release_notes: newVersionObj.notes.trim() || 'Actualización menor de sistema y mejoras de estabilidad.',
          is_active: true,
          published_by: user?.id
        });

      if (error) throw error;

      toast.success('Nueva versión publicada exitosamente', {
        description: 'Todos los clientes conectados recibirán el aviso de actualización al instante.'
      });
      setNewVersionObj({ version: '', notes: '' });

    } catch (error: any) {
      console.error('Error publishing version:', error);
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        toast.error('Esta versión ya fue publicada antes. Utiliza un nombre o build diferente.');
      } else {
        toast.error('Error al publicar nueva versión', { description: error.message });
      }
    } finally {
      setIsPublishingVersion(false);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Configuración"
        subtitle="Administra tus preferencias y opciones del sistema."
      />

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
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

            {/* Apariencia */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <CardTitle>Apariencia</CardTitle>
                </div>
                <CardDescription>Personaliza el tema y la apariencia de la aplicación.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base">Tema</Label>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                      Elige cómo quieres que se vea la aplicación.
                    </p>
                  </div>

                  <ThemeSelector
                    value={themeMode === 'system' ? 'auto' : themeMode}
                    onChange={setThemeMode}
                  />

                  <p className="text-xs text-muted-foreground pt-2">
                    {themeMode === 'auto' && '🌓 Automático: Oscuro de 20:00 a 06:00, claro el resto del día'}
                    {themeMode === 'light' && '☀️ Modo claro activado'}
                    {themeMode === 'dark' && '🌙 Modo oscuro activado'}
                    {themeMode === 'system' && '💻 Siguiendo configuración del sistema'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Personalización */}


            {/* Inventario y Escáner */}
            {isAdmin && (
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
                    <Switch checked={settings.haptics} onCheckedChange={(val) => updateSetting('haptics', val)} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Sonidos</Label>
                      <p className="text-sm text-muted-foreground">
                        Reproducir sonido de confirmación.
                      </p>
                    </div>
                    <Switch checked={settings.sounds} onCheckedChange={(val) => updateSetting('sounds', val)} />
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between">
                      <Label>Sensibilidad del Escáner</Label>
                      <span className="text-sm text-muted-foreground">{settings.scannerSensitivity}%</span>
                    </div>
                    <Slider
                      value={[settings.scannerSensitivity]}
                      onValueChange={(val) => updateSetting('scannerSensitivity', val[0])}
                      max={100}
                      step={10}
                      className="w-full"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sincronización */}
            {isAdmin && (
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
                    <Switch checked={settings.autoSync} onCheckedChange={(val) => updateSetting('autoSync', val)} />
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
            )}

            {/* Base de Datos */}
            {isAdmin && (
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
                          Actualiza la base de datos con un archivo .xlsx. El archivo debe tener columnas "A: IDProducto", "B: Producto" y "C: Barcodes" (EANs separados por guiones o comas).
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
            )}

            {/* Panel de Administración */}
            {user?.role === 'admin' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <CardTitle>Administración</CardTitle>
                  </div>
                  <CardDescription>Gestión de usuarios y permisos del sistema.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {hasPermission(user, 'MANAGE_USERS') && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => navigate('/admin/users')}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Gestión de Usuarios
                      </Button>
                    </div>
                  )}

                  {/* Herramientas de Datos */}
                  <div className="pt-4 border-t">
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                        <div>
                          <h3 className="font-medium mb-1">Asignación Masiva de Laboratorios</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            Sube <code className="bg-background px-1 py-0.5 rounded text-xs">lab_sucu.xlsx</code> para actualizar asignaciones por sucursal.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleImportLaboratories}
                            disabled={isImportingLabs}
                            className="cursor-pointer"
                          />
                        </div>
                        {isImportingLabs && (
                          <p className="text-sm text-muted-foreground mt-2 animate-pulse">
                            Procesando archivo...
                          </p>
                        )}
                      </div>

                      <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                        <div>
                          <h3 className="font-medium mb-1">Asignación Individual por Sucursal</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            Selecciona una sucursal y sube el archivo maestro para actualizar solo esa farmacia.
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Sucursal a actualizar</Label>
                            <Select value={selectedBranchImport} onValueChange={setSelectedBranchImport}>
                              <SelectTrigger>
                                <SelectValue>Seleccionar sucursal...</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {BRANCH_NAMES.map(name => (
                                  <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Archivo Maestro (.xlsx)</Label>
                            <Input
                              type="file"
                              accept=".xlsx, .xls"
                              onChange={handleImportIndividualLaboratories}
                              disabled={isImportingLabs || !selectedBranchImport}
                              className="cursor-pointer"
                            />
                          </div>
                        </div>
                        {!selectedBranchImport && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                             Primero selecciona una sucursal para habilitar la carga.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sistema */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  <CardTitle>Sistema</CardTitle>
                </div>
                <CardDescription>Información de la versión de la aplicación.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <p className="font-medium">Versión Actual Ejecutándose (Local)</p>
                    <p className="text-sm text-primary font-mono bg-primary/10 inline-block px-1.5 py-0.5 rounded">{CURRENT_APP_VERSION}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Última Publicada (Nube)</p>
                    <p className="text-sm text-muted-foreground">{latestVersion?.version || 'Igual que local'}</p>
                  </div>
                </div>

                {isGcoz && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-primary font-medium mb-2">
                      <DownloadCloud className="w-4 h-4" />
                      <h4>Publicar Nueva Actualización a Sucursales</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Completa estos datos después de hacer <code className="bg-muted px-1 py-0.5 rounded">git push</code> para obligar a todas las sucursales a recargar sus navegadores y obtener el nuevo código al instante.
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nombre de la Nueva Versión</Label>
                        <Input
                          placeholder="ej. v1.3.0 (Build 2026.03.09)"
                          value={newVersionObj.version}
                          onChange={(e) => setNewVersionObj(p => ({ ...p, version: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Notas de la Versión (Novedades)</Label>
                        <Textarea
                          placeholder="- Nuevo módulo de auditoría...&#10;- Corrección de bugs..."
                          className="min-h-[100px]"
                          value={newVersionObj.notes}
                          onChange={(e) => setNewVersionObj(p => ({ ...p, notes: e.target.value }))}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handlePublishVersion}
                      disabled={isPublishingVersion || !newVersionObj.version.trim()}
                      className="w-full sm:w-auto"
                    >
                      <DownloadCloud className="w-4 h-4 mr-2" />
                      {isPublishingVersion ? 'Publicando...' : 'Forzar Actualización Global'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {isGcoz && (
              <Card className="border-destructive/50 bg-destructive/5 mt-8">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-destructive">Zona de Peligro (Solo gcoz)</CardTitle>
                  </div>
                  <CardDescription>Acciones destructivas permanentes para el sistema.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive" className="bg-background">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Atención - Acción Destructiva</AlertTitle>
                    <AlertDescription>
                      Esta acción borrará **TODOS** los inventarios, mediciones, ajustes y resúmenes de todas las sucursales del sistema.
                      Esta operación es irreversible y está pensada para la limpieza final previo al lanzamiento.
                    </AlertDescription>
                  </Alert>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isPurging} className="w-full sm:w-auto">
                        {isPurging ? 'Limpiando...' : 'Limpiar Todo el Sistema (Pre-Lanzamiento)'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Se eliminarán permanentemente todos los datos de
                          inventario cíclico y ajustes de todas las sucursales.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePurgeAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Sí, borrar todo el sistema
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>


      </Tabs >
    </PageLayout >
  );
}
