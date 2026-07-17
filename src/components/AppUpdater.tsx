import { useEffect, useState, useRef } from 'react';
import { useAppVersion } from '@/hooks/useAppVersion';
import { sileo } from '@/components/ui/sileo';
import { Button } from '@/components/ui/button';
import { BookOpen01 as BookOpen } from '@untitledui/icons';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
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
    const [showChangelog, setShowChangelog] = useState(false);
    const [changelogNotes, setChangelogNotes] = useState<string>('');
    const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        checkForUpdates();
        setupRealtimeSubscription();
        return () => {
            cleanupSubscription();
            if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
        };
    }, []);

    // Check if this version was already acknowledged
    const isAcknowledged = latestVersion
        ? localStorage.getItem(ACKNOWLEDGED_VERSION_KEY) === latestVersion.version
        : false;

    const handleUpdate = () => {
        if (!latestVersion) return;

        // Mark this version as acknowledged so the toast won't reappear
        localStorage.setItem(ACKNOWLEDGED_VERSION_KEY, latestVersion.version);
        setChangelogNotes(latestVersion.release_notes || 'Optimización del sistema y corrección de errores.');

        const updatePromise = (async () => {
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

            // 3. Pause for progress animation visibility
            await new Promise(resolve => setTimeout(resolve, 1800));
        })();

        sileo.promise(updatePromise, {
            loading: {
                id: "app-updater-toast",
                title: "Instalando versión",
                description: `Descargando v${latestVersion.version} y limpiando archivos...`,
            },
            success: {
                title: "Actualización exitosa",
                description: "Aplicación actualizada correctamente.",
                button: {
                    title: "Ver novedades",
                    onClick: () => {
                        // Cancel automatic reload
                        if (reloadTimeoutRef.current) {
                            clearTimeout(reloadTimeoutRef.current);
                            reloadTimeoutRef.current = null;
                        }
                        // Open the dialog
                        setShowChangelog(true);
                    }
                }
            },
            error: {
                title: "Error al actualizar",
                description: "Se recargará la aplicación de todos modos.",
            }
        });

        updatePromise.then(() => {
            // Automatic reload in 6 seconds if they don't click "Ver novedades"
            reloadTimeoutRef.current = setTimeout(() => {
                window.location.href = window.location.href.split('?')[0] + '?update=' + new Date().getTime();
            }, 6000);
        }).catch(() => {
            setTimeout(() => {
                window.location.reload();
            }, 1200);
        });
    };

    const handleCloseChangelog = () => {
        setShowChangelog(false);
        // Reload immediately
        window.location.href = window.location.href.split('?')[0] + '?update=' + new Date().getTime();
    };

    useEffect(() => {
        if (isUpdateAvailable && latestVersion && !isAcknowledged && !dismissed) {
            sileo.info({
                id: "app-updater-toast",
                title: "Actualización disponible",
                description: `Nueva versión v${latestVersion.version} lista para aplicar.`,
                duration: null, // Keep open until action
                button: {
                    title: "Actualizar ahora",
                    onClick: handleUpdate
                }
            });
        }
    }, [isUpdateAvailable, latestVersion, isAcknowledged, dismissed]);

    return (
        <Dialog open={showChangelog} onOpenChange={(open) => !open && handleCloseChangelog()}>
            <DialogContent size="lg">
                <DialogHeader>
                    <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground text-background">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle>Novedades de la actualización</DialogTitle>
                            <DialogDescription>
                                Se aplicaron los siguientes cambios en esta versión:
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                
                <div className="px-6 py-2">
                    <div className="text-[13px] text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-[220px] overflow-y-auto pr-1">
                        {changelogNotes}
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose render={<Button variant="ghost" onClick={handleCloseChangelog} />}>
                        Entendido
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
