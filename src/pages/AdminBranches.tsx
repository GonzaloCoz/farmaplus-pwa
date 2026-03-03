import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notify } from "@/lib/notifications";
import { Plus, Check } from "lucide-react";
import { AddCircle, Restart as Loader2, Diskette as Save, TrashBinMinimalistic as Trash2, Calendar } from "@solar-icons/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cyclicInventoryService } from "@/services/cyclicInventoryService";
import { PageLayout } from "@/components/layout/PageLayout";
import { useQueryClient } from "@tanstack/react-query";

interface Branch {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    config: any;
}

export default function AdminBranches() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [selectedBranchNames, setSelectedBranchNames] = useState<string[]>([]);
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
    const [bulkDays, setBulkDays] = useState<number>(30);
    const [bulkStartDate, setBulkStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isSavingBulk, setIsSavingBulk] = useState(false);

    const { user } = useUser();
    const queryClient = useQueryClient();

    // New Branch State
    const [newName, setNewName] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newAddress, setNewAddress] = useState("");

    useEffect(() => {
        loadBranches();
    }, []);

    const loadBranches = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('branches')
            .select('*')
            .order('name');

        if (error) {
            notify.error("Error de carga", "No se pudieron cargar las sucursales");
            console.error(error);
        } else {
            setBranches(data || []);
        }
        setIsLoading(false);
    };

    const handleCreate = async () => {
        if (!newName || !newSlug) {
            notify.error("Datos incompletos", "Nombre y Slug son requeridos");
            return;
        }

        const { error } = await supabase.from('branches').insert({
            name: newName,
            slug: newSlug,
            address: newAddress
        });

        if (error) {
            notify.error("Error al crear", "No se pudo crear la sucursal: " + error.message);
        } else {
            notify.success("Sucursal creada", "La sucursal se creó exitosamente");
            setNewName("");
            setNewSlug("");
            setNewAddress("");
            setIsCreating(false);
            loadBranches();
        }
    };

    const generateSlug = (name: string) => {
        return name.toLowerCase().trim().replace(/\s+/g, '');
    };

    const toggleSelectAll = () => {
        if (selectedBranchNames.length === branches.length) {
            setSelectedBranchNames([]);
        } else {
            setSelectedBranchNames(branches.map(b => b.name));
        }
    };

    const toggleSelectBranch = (branchName: string) => {
        setSelectedBranchNames(prev =>
            prev.includes(branchName)
                ? prev.filter(name => name !== branchName)
                : [...prev, branchName]
        );
    };

    const handleBulkSave = async () => {
        if (selectedBranchNames.length === 0) return;

        setIsSavingBulk(true);
        try {
            await cyclicInventoryService.saveBulkBranchConfig(
                selectedBranchNames,
                bulkDays,
                bulkStartDate
            );
            notify.success("Configuración actualizada", `Se actualizaron ${selectedBranchNames.length} sucursales`);

            // Invalidate monitor summaries to force refresh when user returns to dashboard
            queryClient.invalidateQueries({ queryKey: ['branch-summaries-lite'] });

            setIsBulkDialogOpen(false);
            setSelectedBranchNames([]);
        } catch (error) {
            notify.error("Error al actualizar", "No se pudo realizar la asignación masiva");
        } finally {
            setIsSavingBulk(false);
        }
    };

    return (
        <PageLayout>
            <PageHeader
                title="Administración de Sucursales"
                subtitle="Gestiona las sucursales del sistema"
                actions={
                    <div className="flex gap-2">
                        {selectedBranchNames.length > 0 && (
                            <Button
                                variant="outline"
                                className="border-primary text-primary hover:bg-primary/10"
                                onClick={() => setIsBulkDialogOpen(true)}
                            >
                                <Calendar className="mr-2 h-4 w-4" /> Asignar Plazo ({selectedBranchNames.length})
                            </Button>
                        )}
                        <Button onClick={() => setIsCreating(!isCreating)}>
                            {isCreating ? 'Cancelar' : <><Plus className="mr-2 h-4 w-4" /> Nueva Sucursal</>}
                        </Button>
                    </div>
                }
            />

            {isCreating && (
                <Card className="mb-6">
                    <CardHeader><CardTitle>Nueva Sucursal</CardTitle></CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Nombre</Label>
                                <Input
                                    placeholder="Nombre (ej: Belgrano X)"
                                    value={newName}
                                    onChange={(e) => {
                                        setNewName(e.target.value);
                                        if (!newSlug) setNewSlug(generateSlug(e.target.value));
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug (Usuario)</Label>
                                <Input
                                    placeholder="Slug (ej: belgranox)"
                                    value={newSlug}
                                    onChange={(e) => setNewSlug(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Dirección</Label>
                                <Input
                                    placeholder="Dirección"
                                    value={newAddress}
                                    onChange={(e) => setNewAddress(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button onClick={handleCreate} className="w-fit"><Save className="mr-2 h-4 w-4" /> Guardar</Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">
                                    <Checkbox
                                        checked={branches.length > 0 && selectedBranchNames.length === branches.length}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Slug (Usuario)</TableHead>
                                <TableHead>Dirección</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : branches.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4">No hay sucursales registradas</TableCell>
                                </TableRow>
                            ) : (
                                branches.map((branch) => (
                                    <TableRow key={branch.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedBranchNames.includes(branch.name)}
                                                onCheckedChange={() => toggleSelectBranch(branch.name)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{branch.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{branch.slug}</TableCell>
                                        <TableCell>{branch.address || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Asignación Masiva de Plazo</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="days">Días para el Inventario Cíclico</Label>
                            <Input
                                id="days"
                                type="number"
                                value={bulkDays}
                                onChange={(e) => setBulkDays(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Las sucursales seleccionadas se bloquearán automáticamente al pasar estos días.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Fecha de Inicio del Ciclo</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={bulkStartDate}
                                onChange={(e) => setBulkStartDate(e.target.value)}
                            />
                        </div>
                        <div className="bg-muted/30 p-3 rounded-lg border border-border">
                            <p className="text-xs font-semibold mb-1">Sucursales seleccionadas ({selectedBranchNames.length}):</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-2">
                                {selectedBranchNames.join(', ')}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleBulkSave} disabled={isSavingBulk}>
                            {isSavingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Aplicar a {selectedBranchNames.length} sucursales
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageLayout>
    );
}

