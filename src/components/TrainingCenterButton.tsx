import React from "react";
import { NotebookBookmark } from "@solar-icons/react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface TrainingCenterButtonProps {
    className?: string;
    url?: string;
}

export function TrainingCenterButton({
    className,
    url = "https://capacitacion.farmaplus.com.ar"
}: TrainingCenterButtonProps) {
    const handleOpenLink = () => {
        window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <button
                    className={cn(
                        "inline-flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 border border-border/40 hover:bg-muted/80 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                        className
                    )}
                    title="Centro de Capacitación"
                >
                    <NotebookBookmark className="w-5 h-5 text-muted-foreground" />
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[1.5rem] border-muted/50 shadow-2xl backdrop-blur-md bg-white/95 dark:bg-zinc-900/95">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <NotebookBookmark className="w-6 h-6 text-primary" />
                        </div>
                        Aviso de salida
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-base py-2">
                        Estás a punto de salir de la aplicación para dirigirte al centro de capacitación externo. ¿Deseas continuar?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-2">
                    <AlertDialogCancel className="rounded-xl border-border/60 font-semibold h-11">
                        Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleOpenLink}
                        className="rounded-xl font-bold h-11 shadow-lg shadow-primary/20 bg-primary hover:primary/90"
                    >
                        Abrir enlace
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
