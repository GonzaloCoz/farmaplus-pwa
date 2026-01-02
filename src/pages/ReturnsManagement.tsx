import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReturnsTable } from '@/components/returns/ReturnsTable'
import { CreateReturnDialog } from '@/components/returns/CreateReturnDialog'
import { returnsService, ReturnItem, CreateReturnDTO } from '@/services/returnsService'
import { useUser } from '@/contexts/UserContext'
import { toast } from 'sonner'

export default function ReturnsManagement() {
    const { user } = useUser();
    const [returns, setReturns] = useState<ReturnItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const loadReturns = async () => {
        setIsLoading(true);
        try {
            // If admin, maybe allow filtering by branch? For now, load user's branch
            const branchToLoad = user?.role === 'admin' ? undefined : user?.branchName;
            const data = await returnsService.getAll(branchToLoad);
            setReturns(data);
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar devoluciones");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadReturns();
    }, [user]);

    const handleCreate = async (data: CreateReturnDTO) => {
        try {
            await returnsService.create(data);
            toast.success("Devolución registrada correctamente");
            loadReturns();
        } catch (error) {
            console.error(error);
            toast.error("Error al crear registro");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que deseas eliminar este registro?")) return;
        try {
            await returnsService.delete(id);
            toast.success("Registro eliminado");
            setReturns(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar");
        }
    }

    const handleEdit = (item: ReturnItem) => {
        // TODO: Implement edit dialog (change status, auth code, etc)
        toast.info("Edición no implementada aún (Próximamente)");
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <PageHeader
                title="Gestión de Devoluciones"
                subtitle="Administra mercadería vencida, dañada o recalls."
                actions={
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva Devolución
                    </Button>
                }
            />

            <Card>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="space-y-2">
                            <div className="h-10 w-full bg-muted/20 animate-pulse rounded" />
                            <div className="h-10 w-full bg-muted/20 animate-pulse rounded" />
                            <div className="h-10 w-full bg-muted/20 animate-pulse rounded" />
                        </div>
                    ) : (
                        <ReturnsTable
                            data={returns}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                        />
                    )}
                </CardContent>
            </Card>

            <CreateReturnDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSubmit={handleCreate}
            />
        </motion.div>
    )
}
