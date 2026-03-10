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
            // Inform user before reload
            notify.success("Actualización en curso", "Reiniciando la aplicación para aplicar los cambios...");

            // Give 1 second for the notification to be seen
            await new Promise(resolve => setTimeout(resolve, 800));

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
            <AlertDialogContent className="max-w-[700px] w-[90vw] p-0 overflow-hidden border-none bg-background/60 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/40 shadow-2xl elevation-10 rounded-[32px]">
                <div className="relative">
                    {/* Windows-style Header Banner - Modernized */}
                    <div className="bg-gradient-to-br from-blue-600/90 via-primary/90 to-indigo-600/90 p-8 text-white flex items-center justify-between overflow-hidden relative">
                        {/* Decorative background circle */}
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />

                        <div className="flex items-center gap-5 relative z-10">
                            <div className="bg-white/20 p-4 rounded-2xl ring-1 ring-white/30 backdrop-blur-md shadow-inner">
                                <DownloadCloud className="w-8 h-8 text-white animate-pulse" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight leading-tight">Actualización Lista</h2>
                                <p className="text-white/70 text-sm font-medium">Farmaplus Gestión • Sistema Central</p>
                            </div>
                        </div>
                        <div className="hidden sm:block opacity-20 relative z-10">
                            <RefreshCw className="w-24 h-24 rotate-12" />
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        <AlertDialogHeader className="space-y-4">
                            <AlertDialogTitle className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                                Versión <span className="text-primary bg-primary/10 px-3 py-1 rounded-xl text-lg font-mono border border-primary/20">{latestVersion.version}</span>
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-lg leading-relaxed text-foreground/70 font-medium">
                                Hemos publicado mejoras significativas y correcciones críticas. Para garantizar la integridad de tus datos, es necesario reiniciar la aplicación.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        {/* Release Notes Area */}
                        {latestVersion.release_notes && (
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                                <Card className="relative border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden rounded-2xl">
                                    <div className="bg-muted/50 px-5 py-3 font-semibold text-xs uppercase tracking-widest flex items-center gap-2 border-b border-border/40 text-muted-foreground">
                                        <ServerCrash className="w-4 h-4" />
                                        Log de cambios
                                    </div>
                                    <ScrollArea className="h-[140px] w-full p-5">
                                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                                            {latestVersion.release_notes}
                                        </div>
                                    </ScrollArea>
                                </Card>
                            </div>
                        )}

                        <div className="bg-amber-500/5 dark:bg-amber-500/10 p-5 border border-amber-500/20 rounded-2xl text-[15px] text-amber-700 dark:text-amber-400 font-medium flex gap-3 items-center">
                            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            <span>Tus sesiones activas y datos guardados se mantendrán protegidos.</span>
                        </div>

                        <AlertDialogFooter className="pt-2">
                            <Button
                                onClick={handleUpdate}
                                className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all rounded-2xl bg-primary hover:bg-primary/90 flex items-center justify-center gap-3"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Actualizar y Reiniciar Ahora
                            </Button>
                        </AlertDialogFooter>
                    </div>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}
