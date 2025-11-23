import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            // Prevenir que el navegador muestre su propio prompt
            e.preventDefault();
            // Guardar el evento para usarlo después
            setDeferredPrompt(e);
            // Mostrar nuestro prompt personalizado
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        // Mostrar el prompt de instalación
        deferredPrompt.prompt();

        // Esperar la respuesta del usuario
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);

        // Limpiar el prompt
        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // Guardar en localStorage que el usuario cerró el prompt
        localStorage.setItem('install-prompt-dismissed', 'true');
    };

    // No mostrar si ya fue cerrado anteriormente
    useEffect(() => {
        const dismissed = localStorage.getItem('install-prompt-dismissed');
        if (dismissed === 'true') {
            setShowPrompt(false);
        }
    }, []);

    // Auto-dismiss después de 10 segundos
    useEffect(() => {
        if (showPrompt) {
            const timer = setTimeout(() => {
                setShowPrompt(false);
            }, 10000); // 10 segundos

            return () => clearTimeout(timer);
        }
    }, [showPrompt]);

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-[calc(var(--bottom-nav-height)+1rem)] sm:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40 bg-card border rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-5">
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted"
                aria-label="Cerrar"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Download className="w-6 h-6 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">Instalar Farmaplus</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                        Instala la app para acceso rápido y funcionalidad offline
                    </p>

                    <Button onClick={handleInstall} size="sm" className="w-full">
                        Instalar ahora
                    </Button>
                </div>
            </div>
        </div>
    );
}
