import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CloseCircle as X, Download } from "@solar-icons/react";
import { useInstallPWA } from "@/contexts/InstallPWAContext";

export function InstallPrompt() {
    const { installPrompt, showInstallPrompt } = useInstallPWA();
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        if (installPrompt) {
            const dismissed = localStorage.getItem('install-prompt-dismissed');
            if (dismissed !== 'true') {
                setShowPrompt(true);
            }
        }
    }, [installPrompt]);

    const handleInstall = async () => {
        showInstallPrompt();
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('install-prompt-dismissed', 'true');
    };

    // Auto-dismiss después de 15 segundos
    useEffect(() => {
        if (showPrompt) {
            const timer = setTimeout(() => {
                setShowPrompt(false);
            }, 15000);

            return () => clearTimeout(timer);
        }
    }, [showPrompt]);

    if (!showPrompt || !installPrompt) return null;

    return (
        <div className="fixed bottom-[calc(var(--bottom-nav-height)+1rem)] sm:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] bg-card/95 backdrop-blur-md border border-primary/20 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5">
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/50 transition-colors"
                aria-label="Cerrar"
            >
                <X className="w-5 h-5 opacity-40 hover:opacity-100 transition-opacity" />
            </button>

            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
                    <Download className="w-7 h-7 text-primary" />
                </div>

                <div className="flex-1 min-w-0 pr-6">
                    <h3 className="font-bold text-base mb-0.5 text-foreground/90">Instalar Aplicación</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                        Acceso rápido desde tu pantalla de inicio y mejor rendimiento.
                    </p>

                    <div className="flex gap-2">
                        <Button onClick={handleInstall} size="sm" className="flex-1 rounded-xl font-bold shadow-lg shadow-primary/20">
                            Instalar ahora
                        </Button>
                        <Button onClick={handleDismiss} variant="ghost" size="sm" className="rounded-xl text-xs opacity-60">
                            Después
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
