import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, Wifi, WifiOff } from "lucide-react";
import { getUnsyncedItems, PreCountItem } from "@/services/preCountDB";
import { notify } from '@/lib/notifications';
import { cn } from "@/lib/utils";

export function SyncStatusBottomSheet({ children }: { children?: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [unsyncedItems, setUnsyncedItems] = useState<PreCountItem[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        loadUnsyncedItems();

        // Poll for changes every 5 seconds
        const interval = setInterval(loadUnsyncedItems, 5000);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
            clearInterval(interval);
        };
    }, []);

    const loadUnsyncedItems = async () => {
        try {
            const items = await getUnsyncedItems();
            setUnsyncedItems(items);
        } catch (e) {
            console.error("Error loading unsynced items", e);
        }
    };

    const handleSync = async () => {
        if (!isOnline) {
            notify.error("Error", "No hay conexión a internet");
            return;
        }

        setIsSyncing(true);
        try {
            // Simulate sync delay
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // In a real app, here we would upload the items
            // await syncService.upload(unsyncedItems);

            // For now, we'll just show a success message
            notify.success("Operación exitosa", "Sincronización completada (Simulada)");

            // Refresh list (in real app, items would be marked as synced)
            await loadUnsyncedItems();
        } catch (e) {
            notify.error("Error", "Error al sincronizar");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                {children || (
                    <Button variant="ghost" size="icon" className="relative">
                        {isOnline ? (
                            unsyncedItems.length > 0 ? (
                                <Cloud className="h-5 w-5 text-warning" />
                            ) : (
                                <Cloud className="h-5 w-5 text-muted-foreground" />
                            )
                        ) : (
                            <CloudOff className="h-5 w-5 text-destructive" />
                        )}
                        {unsyncedItems.length > 0 && (
                            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
                        )}
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[50vh] rounded-t-3xl">
                <SheetHeader className="mb-6">
                    <SheetTitle className="flex items-center gap-2">
                        <RefreshCw className={cn("h-5 w-5", isSyncing && "animate-spin")} />
                        Centro de Sincronización
                    </SheetTitle>
                </SheetHeader>

                <div className="space-y-6">
                    {/* Status Card */}
                    <div className={cn(
                        "p-4 rounded-xl border flex items-center justify-between",
                        isOnline ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"
                    )}>
                        <div className="flex items-center gap-3">
                            {isOnline ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-destructive" />}
                            <div>
                                <p className="font-medium">{isOnline ? "Conectado" : "Sin conexión"}</p>
                                <p className="text-xs text-muted-foreground">
                                    {isOnline ? "Listo para sincronizar" : "Los cambios se guardarán localmente"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pending Items */}
                    <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">
                            Pendientes de subida ({unsyncedItems.length})
                        </h4>

                        {unsyncedItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <CheckCircle2 className="h-12 w-12 mb-2 opacity-20" />
                                <p>Todo está sincronizado</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[150px] overflow-auto">
                                {unsyncedItems.slice(0, 5).map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                                        <span className="truncate max-w-[200px]">{item.productName}</span>
                                        <span className="font-mono text-xs">{item.quantity} un.</span>
                                    </div>
                                ))}
                                {unsyncedItems.length > 5 && (
                                    <p className="text-xs text-center text-muted-foreground pt-2">
                                        + {unsyncedItems.length - 5} más...
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={handleSync}
                        disabled={!isOnline || unsyncedItems.length === 0 || isSyncing}
                    >
                        {isSyncing ? "Sincronizando..." : "Sincronizar Ahora"}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
