import { useState, useEffect, useCallback } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { Bell01 as Bell, Shield01 as Shield, Users01 as Users, RefreshCw01 as RefreshCw, InfoCircle as Info, DownloadCloud01 as DownloadCloud } from '@untitledui/icons';
import { sileo } from "@/components/ui/sileo";

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
import { useTheme } from "@/hooks/useTheme";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { BookOpen01 as BookOpen } from '@untitledui/icons';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAppVersion, CURRENT_APP_VERSION } from '@/hooks/useAppVersion';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, allBranches } = useUser();
  const isAdmin = user?.role === 'admin';
  const { preferences, setPosition, setReminderType } = useNotificationPreferences();
  const { themeMode, setThemeMode } = useTheme();
  const queryClient = useQueryClient();

  const [isImportingLabs, setIsImportingLabs] = useState(false);
  const [isUpdatingGoals, setIsUpdatingGoals] = useState(false);
  const isGcoz = user?.username.toLowerCase() === 'gcoz';

  // App Version state
  const { currentVersion, latestVersion } = useAppVersion();
  const [isPublishingVersion, setIsPublishingVersion] = useState(false);
  const [newVersionObj, setNewVersionObj] = useState({ version: '', notes: '' });
  const [selectedBranchImport, setSelectedBranchImport] = useState<string>("");
  const [showChangelog, setShowChangelog] = useState(false);

  // Add auto-generated version prefix on load
  useEffect(() => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getDate().toString().padStart(2, '0')}`;
    setNewVersionObj(prev => ({ ...prev, version: `v1.2.x (Build ${dateStr})` }));
  }, []);

  const handleTriggerTestUpdate = () => {
    sileo.info({
      id: "app-updater-toast",
      title: "Actualización disponible (Prueba)",
      description: "Nueva versión v1.4.3.1 (Prueba) lista para aplicar.",
      duration: null,
      button: {
        title: "Actualizar ahora",
        onClick: () => {
          const testPromise = new Promise(resolve => setTimeout(resolve, 2000));
          sileo.promise(testPromise, {
            loading: {
              id: "app-updater-toast",
              title: "Instalando versión (Prueba)",
              description: "Descargando v1.4.3.1 (Prueba) y limpiando archivos...",
            },
            success: {
              title: "Actualización exitosa (Prueba)",
              description: "Se ha simulado la actualización correctamente.",
              button: {
                title: "Ver novedades",
                onClick: () => {
                  setShowChangelog(true);
                }
              }
            },
            error: {
              title: "Error al actualizar",
              description: "Fallo de prueba.",
            }
          });
        }
      }
    });
  };

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

      // Process each branch in allBranches
      for (const branchName of allBranches) {
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

      // Fetch ALL existing labs to build a lookup map of progress and status
      const { data: existingLabsBulk, error: fetchBulkError } = await supabase
        .from('branch_laboratories')
        .select('*');

      if (fetchBulkError) throw new Error(`Error fetching existing labs: ${fetchBulkError.message}`);

      const existingLabsBulkMap = new Map<string, any>();
      existingLabsBulk?.forEach(row => {
        const key = `${row.branch_name.toUpperCase().trim()}|${row.laboratory.toUpperCase().trim()}|${row.category.toUpperCase().trim()}`;
        existingLabsBulkMap.set(key, row);
      });

      // 2. Insert/Update new assignments using UPSERT (Non-destructive to progress)
      const insertData = Array.from(uniqueAssignments.values()).map(a => {
        const key = `${a.branch.toUpperCase().trim()}|${a.lab.toUpperCase().trim()}|${a.category.toUpperCase().trim()}`;
        const existing = existingLabsBulkMap.get(key);
        const hasProgress = existing && ((existing.progress_percentage || 0) > 0 || existing.status !== 'pending');

        if (hasProgress) {
          // Preserve existing stats and status
          return {
            ...existing,
            branch_name: a.branch,
            laboratory: a.lab,
            category: a.category
          };
        } else {
          return {
            branch_name: a.branch,
            laboratory: a.lab,
            category: a.category,
            status: 'pending' as const,
            progress_percentage: 0
          };
        }
      });

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
      // 1. Fetch existing labs for this branch (WITH PROGRESS & STATS)
      const { data: existingLabs, error: fetchError } = await supabase
        .from('branch_laboratories')
        .select('*')
        .eq('branch_name', selectedBranchUpper);

      if (fetchError) throw fetchError;

      // Map existing records by composite key "LAB|CAT"
      const existingLabsMap = new Map<string, any>();
      existingLabs?.forEach(row => {
        const key = `${row.laboratory.toUpperCase()}|${row.category.toUpperCase()}`;
        existingLabsMap.set(key, row);
      });

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
                
                const existing = existingLabsMap.get(key);
                const hasProgress = existing && ((existing.progress_percentage || 0) > 0 || existing.status !== 'pending');

                if (hasProgress) {
                  // PRESERVE: Keep all existing stats and status
                  newAssignments.push({
                    ...existing,
                    branch_name: selectedBranchUpper,
                    laboratory: labName,
                    category: category
                  });
                } else {
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
      }

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





  const handlePublishVersion = async () => {
    if (!newVersionObj.version.trim()) {
      toast.error('Ingresa un número de versión válido');
      return;
    }

    setIsPublishingVersion(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      // First, try using an RPC if available (bypasses RLS)
      const { error: rpcError } = await (supabase as any).rpc('publish_app_version', {
        p_version: newVersionObj.version.trim(),
        p_release_notes: newVersionObj.notes.trim() || 'Actualización menor de sistema y mejoras de estabilidad.',
        p_published_by: authUser?.id
      });

      if (rpcError) {
        // Fallback: Try direct insert (requires RLS policy)
        const { error: insertError } = await (supabase as any)
          .from('app_versions')
          .insert({
            version: newVersionObj.version.trim(),
            release_notes: newVersionObj.notes.trim() || 'Actualización menor de sistema y mejoras de estabilidad.',
            is_active: true,
            published_by: authUser?.id
          });

        if (insertError) {
          // If it's an RLS error, provide a clear message
          if (insertError.message?.includes('row-level security') || insertError.code === '42501') {
            throw new Error(
              'Política de seguridad (RLS) bloqueó la inserción. ' +
              'Ejecutá en Supabase SQL Editor:\n\n' +
              'CREATE POLICY "Allow authenticated insert" ON app_versions FOR INSERT TO authenticated WITH CHECK (true);'
            );
          }
          throw insertError;
        }
      }

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
                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    {hasPermission(user, 'MANAGE_USERS') && (
                      <Button
                        variant="outline"
                        className="flex-1 justify-start"
                        onClick={() => navigate('/admin/users')}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Gestión de Usuarios
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      className="flex-1 justify-start text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                      onClick={handleTriggerTestUpdate}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Probar Alerta de Actualización PWA
                    </Button>
                  </div>

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
                                {allBranches.map((name, idx) => (
                                  <SelectItem key={name} index={idx} value={name}>{name}</SelectItem>
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

          </div>
        </TabsContent>


      </Tabs >

      <Dialog open={showChangelog} onOpenChange={setShowChangelog}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Novedades de la actualización (Prueba)</DialogTitle>
            <DialogDescription>
              Se aplicaron los siguientes cambios y correcciones en esta versión de prueba:
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-2">
            <div className="text-[13px] text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-y-auto pr-1">
              {"- Optimización del sistema de notificaciones con Sileo.\n- Soporte de transiciones fluidas de carga en actualizaciones.\n- Integración de log de cambios en toasts."}
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" onClick={() => setShowChangelog(false)} />}>
              Entendido
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageLayout >
  );
}
