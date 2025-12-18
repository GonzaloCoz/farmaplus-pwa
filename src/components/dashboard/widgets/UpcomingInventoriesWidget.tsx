import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { CalendarClock, Plus, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { calendarService } from '@/services/calendarService';
import { toast } from "sonner";
import { AddEventDialog } from '@/components/AddEventDialog'; // Assuming this exists or will use inline

interface UpcomingInventory {
    id: string;
    branch: string;
    sector: string;
    date: string;
    formattedDate: string;
}

interface Props {
    onDateClick?: (dateIso: string) => void;
}

export function UpcomingInventoriesWidget({ onDateClick }: Props) {
    const { user } = useUser();
    const isAdmin = user?.role === 'admin';
    const [inventories, setInventories] = useState<UpcomingInventory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);

    useEffect(() => {
        loadData();
    }, [user?.branchName]);

    const loadData = async () => {
        try {
            const events = await calendarService.getEvents(user?.branchName, isAdmin);

            const todayStr = new Date().toISOString().slice(0, 10);

            const upcoming = events
                .filter((e: any) => e.date >= todayStr)
                .sort((a: any, b: any) => a.date.localeCompare(b.date))
                .slice(0, 5)
                .map((e: any) => ({
                    id: e.id,
                    branch: e.branch_name || e.branchId, // Fallback
                    sector: e.sector || e.description,
                    date: e.date,
                    formattedDate: new Date(e.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
                }));

            setInventories(upcoming);
        } catch (error) {
            console.error("Error loading upcoming inventories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="p-6 h-full flex flex-col relative">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-muted-foreground">Próximos Inventarios</h2>
                <div className="flex gap-1">
                    {/* Temporarily disabled Add button until AddEventDialog is fully ready/integrated */}
                    {/* 
                    {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddDialog(true)} title="Programar Nuevo">
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                    */}
                </div>
            </div>

            <div className="space-y-4 flex-1">
                {isLoading ? (
                    <div className="space-y-3">
                        <div className="h-12 bg-muted/20 animate-pulse rounded-lg" />
                        <div className="h-12 bg-muted/20 animate-pulse rounded-lg" />
                        <div className="h-12 bg-muted/20 animate-pulse rounded-lg" />
                        <div className="h-12 bg-muted/20 animate-pulse rounded-lg" />
                        <div className="h-12 bg-muted/20 animate-pulse rounded-lg" />
                    </div>
                ) : inventories.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 border rounded-lg border-dashed bg-muted/20">
                        <p className="text-sm text-muted-foreground mb-3">No hay inventarios próximos</p>
                    </div>
                ) : (
                    inventories.map((inv) => (
                        <div
                            key={inv.id}
                            className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => onDateClick?.(inv.date)}
                        >
                            <CalendarClock className="w-5 h-5 text-primary mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{inv.branch} - {inv.sector}</p>
                                <p className="text-xs text-muted-foreground mt-1 text-left block">
                                    {inv.formattedDate}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}
