import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notify } from "@/lib/notifications";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";

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

    return (
        <PageLayout>
            <PageHeader
                title="Administración de Sucursales"
                subtitle="Gestiona las sucursales del sistema"
                actions={
                    <Button onClick={() => setIsCreating(!isCreating)}>
                        {isCreating ? 'Cancelar' : <><Plus className="mr-2 h-4 w-4" /> Nueva Sucursal</>}
                    </Button>
                }
            />

            {isCreating && (
                <Card>
                    <CardHeader><CardTitle>Nueva Sucursal</CardTitle></CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                placeholder="Nombre (ej: Belgrano X)"
                                value={newName}
                                onChange={(e) => {
                                    setNewName(e.target.value);
                                    if (!newSlug) setNewSlug(generateSlug(e.target.value));
                                }}
                            />
                            <Input
                                placeholder="Slug (ej: belgranox)"
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value)}
                            />
                            <Input
                                placeholder="Dirección"
                                value={newAddress}
                                onChange={(e) => setNewAddress(e.target.value)}
                            />
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
                                <TableHead>Nombre</TableHead>
                                <TableHead>Slug (Usuario)</TableHead>
                                <TableHead>Dirección</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : branches.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4">No hay sucursales registradas</TableCell>
                                </TableRow>
                            ) : (
                                branches.map((branch) => (
                                    <TableRow key={branch.id}>
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
        </PageLayout>
    );
}
