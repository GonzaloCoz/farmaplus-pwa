import { useEffect } from 'react';
import { useAppVersion } from '@/hooks/useAppVersion';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DownloadCloud, RefreshCw, ServerCrash } from 'lucide-react';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';

export function AppUpdater() {
    const {
        isUpdateAvailable,
        latestVersion,
        checkForUpdates,
        setupRealtimeSubscription,
        cleanupSubscription
    } = useAppVersion();

    useEffect(() => {
        // 1. Check current DB version on load
        checkForUpdates();

        // 2. Listen to Realtime inserts for immediate reaction
        setupRealtimeSubscription();

        return () => {
            cleanupSubscription();
        };
    }, []);

    const handleUpdate = async () => {
        // Advanced PWA wipe & reload
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

            // 3. Force hard reload from server (bypass cache)
            window.location.href = window.location.href.split('?')[0] + '?update=' + new Date().getTime();
        } catch (e) {
            console.error("Update wipe failed, falling back to basic reload", e);
            window.location.reload();
        }
    };

    if (!isUpdateAvailable || !latestVersion) return null;

    return (
        <AlertDialog open={isUpdateAvailable}>
            <AlertDialogContent className="max-w-md p-0 overflow-hidden border-2 border-primary/20 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
                {/* Windows-style Header Banner */}
                <div className="bg-gradient-to-r from-blue-600 to-primary p-6 text-white flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-full ring-2 ring-white/40">
                        <DownloadCloud className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Actualización Requerida</h2>
                        <p className="text-blue-100 text-sm opacity-90">Farmaplus Gestión de Inventario</p>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <AlertDialogHeader className="space-y-3">
                        <AlertDialogTitle className="text-xl">
                            Nueva versión disponible: <span className="text-primary font-mono bg-primary/10 px-2 py-1 rounded-md text-base">{latestVersion.version}</span>
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base text-foreground/80">
                            Hemos publicado una actualización crítica del sistema. Para garantizar que estés trabajando con los últimos datos y herramientas, es obligatorio actualizar ahora.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {/* Release Notes Area */}
                    {latestVersion.release_notes && (
                        <Card className="border-muted bg-muted/30 overflow-hidden">
                            <div className="bg-muted px-4 py-2 font-medium text-sm flex items-center gap-2 border-b">
                                <ServerCrash className="w-4 h-4 text-muted-foreground" />
                                Novedades de esta versión
                            </div>
                            <ScrollArea className="h-[120px] w-full rounded-b-md p-4">
                                <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                                    {latestVersion.release_notes}
                                </div>
                            </ScrollArea>
                        </Card>
                    )}

                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 border border-blue-100 dark:border-blue-900/30 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                        <strong>Importante:</strong> La aplicación se reiniciará automáticamente. Cualquier conteo pendiente que no haya sido guardado podría perderse.
                    </div>

                    <AlertDialogFooter className="sm:justify-center">
                        <Button
                            onClick={handleUpdate}
                            className="w-full sm:w-auto min-w-[200px] h-11 text-base font-semibold shadow-lg hover:scale-[1.02] transition-transform flex items-center gap-2"
                            size="lg"
                        >
                            <RefreshCw className="w-4 h-4 animate-spin-slow" />
                            Actualizar Ahora
                        </Button>
                    </AlertDialogFooter>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
