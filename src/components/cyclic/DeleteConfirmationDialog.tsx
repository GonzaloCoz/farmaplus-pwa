import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => Promise<void>;
    title?: string;
    description?: React.ReactNode;
    verificationText: string;
    isDeleting?: boolean;
}

export function DeleteConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "¿Estás absolutamente seguro?",
    description,
    verificationText,
    isDeleting = false
}: DeleteConfirmationDialogProps) {
    const [inputValue, setInputValue] = useState("");

    // Reset input when dialog opens
    useEffect(() => {
        if (open) setInputValue("");
    }, [open]);

    const isMatch = inputValue === verificationText;
    // Also allow case-insensitive match for better UX? 
    // The requirement was specific, but usually exact match is safer for "GitHub Style".
    // Let's stick to exact match as requested.

    const handleConfirm = async () => {
        if (!isMatch) return;
        await onConfirm();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription className="py-2">
                        {description || "Esta acción no se puede deshacer. Esto eliminará permanentemente los datos."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20">
                        <AlertTitle className="font-semibold mb-2">Confirmación de Seguridad</AlertTitle>
                        <AlertDescription className="text-sm">
                            Por favor escribe <span className="font-bold select-all bg-destructive/10 px-1 rounded mx-1">{verificationText}</span> para confirmar.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Label htmlFor="verification-input">Escribe el texto de confirmación</Label>
                        <Input
                            id="verification-input"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={verificationText}
                            className={cn(
                                "font-mono text-sm",
                                isMatch ? "border-green-500 focus-visible:ring-green-500" : ""
                            )}
                            autoComplete="off"
                            onPaste={(e) => {
                                // Optional: Prevent paste to force typing? 
                                // GitHub allows paste. It's about 'conscious action', not typing speed test.
                                // We'll allow paste.
                            }}
                        />
                    </div>
                </div>

                <DialogFooter className="sm:justify-between gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={!isMatch || isDeleting}
                        className="w-full sm:w-auto"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Eliminando...
                            </>
                        ) : (
                            "Entiendo, eliminar inventario"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
