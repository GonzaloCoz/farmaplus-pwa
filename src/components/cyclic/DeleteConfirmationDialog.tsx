import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import {
    Dialog,
    DialogPopup,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Danger as AlertTriangle, Restart as Loader2 } from '@solar-icons/react';
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

    const handleConfirm = async () => {
        if (!isMatch) return;
        await onConfirm();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPopup className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {description || "Esta acción no se puede deshacer. Esto eliminará permanentemente los datos."}
                    </DialogDescription>
                </DialogHeader>

                <Form
                    className="contents"
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleConfirm();
                    }}
                >
                    <div className="px-6 py-4 flex flex-col gap-4">
                        <Alert variant="destructive" className="bg-destructive/5 text-destructive border-destructive/20">
                            <AlertTitle className="font-semibold mb-2">Confirmación de Seguridad</AlertTitle>
                            <AlertDescription className="text-sm">
                                Por favor escribe <span className="font-bold select-all bg-destructive/10 px-1 rounded mx-1">{verificationText}</span> para confirmar.
                            </AlertDescription>
                        </Alert>

                        <Field>
                            <FieldLabel>Escribe el texto de confirmación</FieldLabel>
                            <Input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={verificationText}
                                className={cn(
                                    "font-mono text-sm",
                                    isMatch && inputValue.length > 0 ? "border-success focus-visible:ring-success" : ""
                                )}
                                autoComplete="off"
                            />
                            {inputValue.length > 0 && !isMatch && (
                                <FieldError>El texto no coincide. Debe ser idéntico.</FieldError>
                            )}
                        </Field>
                    </div>

                    <DialogFooter>
                        <DialogClose render={<Button type="button" variant="ghost" disabled={isDeleting} />}>
                            Cancelar
                        </DialogClose>
                        <Button
                            type="submit"
                            variant="destructive"
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
                </Form>
            </DialogPopup>
        </Dialog>
    );
}
