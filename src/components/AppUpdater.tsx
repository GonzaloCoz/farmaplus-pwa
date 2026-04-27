import { useEffect, useState } from 'react';
import { useAppVersion } from '@/hooks/useAppVersion';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowDown, X } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { notify } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogPopup,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogPanel,
    DialogFooter,
} from '@/components/ui/dialog';

const ACKNOWLEDGED_VERSION_KEY = 'farmaplus_acknowledged_version';

export function AppUpdater() {
    const {
        isUpdateAvailable,
        latestVersion,
        checkForUpdates,
        setupRealtimeSubscription,
        cleanupSubscription
    } = useAppVersion();

    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        checkForUpdates();
        setupRealtimeSubscription();
        return () => { cleanupSubscription(); };
    }, []);

    // Check if this version was already acknowledged
    const isAcknowledged = latestVersion
        ? localStorage.getItem(ACKNOWLEDGED_VERSION_KEY) === latestVersion.version
        : false;

    const handleUpdate = async () => {
        if (!latestVersion) return;

        // Mark this version as acknowledged so the modal won't reappear
        localStorage.setItem(ACKNOWLEDGED_VERSION_KEY, latestVersion.version);

        try {
            // 1. Unregister all Service Workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }

            // 2. Clear all Caches
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(key => caches.delete(key)));
            }

            // 3. Show success notification
            notify.success("Actualización exitosa", "La aplicación ha sido actualizada correctamente.");

            // 4. Brief pause for notification visibility, then reload
            await new Promise(resolve => setTimeout(resolve, 600));
            window.location.href = window.location.href.split('?')[0] + '?update=' + new Date().getTime();
        } catch (e) {
            console.error("Update wipe failed, falling back to basic reload", e);
            window.location.reload();
        }
    };

    // Don't render if no update, or already acknowledged, or dismissed
    if (!isUpdateAvailable || !latestVersion || isAcknowledged || dismissed) return null;

    return (
        <Dialog open={true} onOpenChange={() => setDismissed(true)}>
            <DialogPopup className="max-w-[500px]" showCloseButton={false}>
                <DialogHeader>
                    <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-foreground text-background">
                            <ArrowDown className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle>Actualización disponible</DialogTitle>
                            <DialogDescription>Farmaplus Gestión • Sistema Central</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <DialogPanel className="space-y-5">
                    {/* Version badge */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground/80">Nueva versión</span>
                        <span className="px-3 py-1 rounded-lg bg-foreground/5 border border-border/40 text-sm font-mono font-bold">
                            {latestVersion.version}
                        </span>
                    </div>

                    {/* Release Notes */}
                    {latestVersion.release_notes && (
                        <div className="rounded-lg border border-border/40 bg-muted/10 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/50">
                                    Log de cambios
                                </span>
                            </div>
                            <div className="h-[120px] w-full p-4 overflow-y-auto no-scrollbar">
                                <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/70 font-medium italic">
                                    {latestVersion.release_notes}
                                </div>
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-muted-foreground/60 font-medium">
                        La aplicación se reiniciará para aplicar los cambios. Tus datos guardados se mantendrán protegidos.
                    </p>
                </DialogPanel>

                <DialogFooter className="justify-between">
                    <span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/30">
                        Actualización recomendable
                    </span>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setDismissed(true)}>
                            Más tarde
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            className="h-10 px-6 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold text-sm flex items-center gap-2 transition-all hover:scale-[1.05] shadow-lg shadow-foreground/10"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Actualizar ahora
                        </Button>
                    </div>
                </DialogFooter>
            </DialogPopup>
        </Dialog>
    );
}

