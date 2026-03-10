import { useEffect, useState } from 'react';
import { useAppVersion } from '@/hooks/useAppVersion';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowDown, X } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { notify } from '@/lib/notifications';
import { cn } from '@/lib/utils';

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
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" />

            {/* Modal */}
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-full max-w-[680px] bg-white/80 dark:bg-black/80 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                                <ArrowDown className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black tracking-tight">Actualización disponible</h2>
                                <p className="text-xs text-muted-foreground font-medium mt-0.5">Farmaplus Gestión • Sistema Central</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setDismissed(true)}
                            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="w-full h-[1px] bg-border/40" />

                    {/* Body */}
                    <div className="px-6 py-5 space-y-5">
                        {/* Version badge */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-foreground/80">Nueva versión</span>
                            <span className="px-3 py-1 rounded-lg bg-foreground/5 border border-border/40 text-sm font-mono font-bold">
                                {latestVersion.version}
                            </span>
                        </div>

                        {/* Release Notes */}
                        {latestVersion.release_notes && (
                            <div className="rounded-2xl border border-border/40 bg-muted/10 overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
                                    <span className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/50">
                                        Log de cambios
                                    </span>
                                </div>
                                <ScrollArea className="h-[120px] w-full p-4">
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/70 font-medium">
                                        {latestVersion.release_notes}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        {/* Warning */}
                        <p className="text-xs text-muted-foreground/60 font-medium">
                            La aplicación se reiniciará para aplicar los cambios. Tus datos guardados se mantendrán protegidos.
                        </p>
                    </div>

                    <div className="w-full h-[1px] bg-border/40" />

                    {/* Footer */}
                    <div className="flex items-center justify-between p-4 px-6">
                        <span className="text-[9px] uppercase tracking-widest font-black text-muted-foreground/30">
                            Actualización obligatoria
                        </span>
                        <Button
                            onClick={handleUpdate}
                            className="h-10 px-6 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold text-sm flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Actualizar y Reiniciar
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
