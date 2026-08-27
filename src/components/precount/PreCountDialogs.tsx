import React from 'react';
import {
    Dialog,
    DialogClose,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPopup,
    DialogTitle,
    DialogPanel,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import { NumericKeyboard } from '@/components/NumericKeyboard';
import { MarkerPin01 as MapPin, FilterLines as Filter, CheckCircle } from '@untitledui/icons';

// --- Finish Session Dialog ---
export interface FinishSessionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    totalProducts: number;
    totalUnits: number;
    finishPassword: string;
    setFinishPassword: (val: string) => void;
    finishPasswordError: string;
    setFinishPasswordError: (val: string) => void;
    onConfirmFinish: () => void;
}

export function FinishSessionDialog({
    open,
    onOpenChange,
    totalProducts,
    totalUnits,
    finishPassword,
    setFinishPassword,
    finishPasswordError,
    setFinishPasswordError,
    onConfirmFinish,
}: FinishSessionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPopup className="sm:max-w-sm">
                <Form className="contents" onSubmit={(e) => { e.preventDefault(); onConfirmFinish(); }}>
                    <DialogHeader>
                        <DialogTitle>Finalizar Sesión</DialogTitle>
                        <DialogDescription>
                            ¿Estás seguro de que deseas finalizar esta sesión? Se guardará el registro de {totalProducts} productos y {totalUnits} unidades.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="px-6 py-4">
                        <Field>
                            <FieldLabel>Contraseña</FieldLabel>
                            <Input
                                type="password"
                                value={finishPassword}
                                onChange={(e) => {
                                    setFinishPassword(e.target.value);
                                    setFinishPasswordError('');
                                }}
                                placeholder="Ingresa la contraseña para confirmar"
                                autoFocus
                            />
                            {finishPasswordError && (
                                <p className="text-xs text-destructive mt-1.5 font-medium">{finishPasswordError}</p>
                            )}
                        </Field>
                    </div>
                    <DialogFooter>
                        <DialogClose render={<Button type="button" variant="ghost" />}>
                            Cancelar
                        </DialogClose>
                        <Button type="submit" disabled={!finishPassword.trim()}>
                            <CheckCircle className="w-4 h-4" />
                            Confirmar y Finalizar
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogPopup>
        </Dialog>
    );
}

// --- No Zone Warning Dialog ---
export interface NoZoneDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenSectorSelector: () => void;
}

export function NoZoneDialog({ open, onOpenChange, onOpenSectorSelector }: NoZoneDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPopup className="max-w-[90vw] rounded-lg sm:max-w-[425px]">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                        <MapPin className="size-6 text-amber-600" />
                    </div>
                    <DialogTitle className="text-center text-xl">Zona no seleccionada</DialogTitle>
                    <DialogDescription className="text-center">
                        Debes seleccionar o escanear una <span className="font-bold text-foreground">Zona</span> antes de empezar a contar productos.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground leading-relaxed">
                        <p className="font-semibold text-foreground mb-1">¿Por qué es necesario?</p>
                        Para mantener el inventario ordenado, cada producto leído debe asignarse a un sector físico (Ej: GO-01, CA-05).
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium px-1">Acciones rápidas:</p>
                        <Button
                            variant="outline"
                            className="justify-start h-11 px-4 rounded-xl"
                            onClick={() => {
                                onOpenChange(false);
                                onOpenSectorSelector();
                            }}
                        >
                            <Filter className="size-4 mr-3 text-primary" />
                            Seleccionar Zona de la lista
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold"
                        onClick={() => onOpenChange(false)}
                    >
                        Entendido
                    </Button>
                </DialogFooter>
            </DialogPopup>
        </Dialog>
    );
}

// --- Add Sector Dialog ---
export interface AddSectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    newSectorName: string;
    setNewSectorName: (val: string) => void;
    onAddSector: (name: string) => void;
}

export function AddSectorDialog({
    open,
    onOpenChange,
    newSectorName,
    setNewSectorName,
    onAddSector,
}: AddSectorDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogPopup className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Nueva Zona / Sector</DialogTitle>
                    <DialogDescription>
                        Ingresa el código de la nueva zona de conteo (Ej: GO-01, CA-02).
                    </DialogDescription>
                </DialogHeader>
                <Form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (newSectorName) {
                            onAddSector(newSectorName);
                            setNewSectorName('');
                            onOpenChange(false);
                        }
                    }}
                    className="contents"
                >
                    <DialogPanel className="grid gap-4">
                        <Field>
                            <FieldLabel>Código del Sector</FieldLabel>
                            <Input
                                autoFocus
                                value={newSectorName}
                                onChange={(e) => setNewSectorName(e.target.value.toUpperCase())}
                                placeholder="Ej: GO-01"
                                className="uppercase font-bold"
                            />
                        </Field>
                    </DialogPanel>
                    <DialogFooter>
                        <DialogClose render={<Button variant="ghost" />}>
                            Cancelar
                        </DialogClose>
                        <Button type="submit" disabled={!newSectorName}>
                            Agregar
                        </Button>
                    </DialogFooter>
                </Form>
            </DialogPopup>
        </Dialog>
    );
}

// --- Virtual Numeric Keyboard Drawer ---
export interface QuantityDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    quantity: number;
    setQuantity: (val: number) => void;
    productName?: string;
    productEAN?: string;
    onConfirm: () => void;
}

export function QuantityDrawer({
    open,
    onOpenChange,
    quantity,
    setQuantity,
    productName,
    productEAN,
    onConfirm,
}: QuantityDrawerProps) {
    return (
        <Drawer
            open={open}
            onOpenChange={(isOpen) => {
                onOpenChange(isOpen);
                if (!isOpen) setQuantity(0);
            }}
            shouldScaleBackground={false}
        >
            <DrawerContent className="outline-none max-h-[92dvh]">
                <DrawerHeader className="sr-only">
                    <DrawerTitle>Ingresar Cantidad</DrawerTitle>
                    <DrawerDescription>
                        Usá el teclado numérico para ingresar la cantidad del producto.
                    </DrawerDescription>
                </DrawerHeader>
                <NumericKeyboard
                    value={quantity}
                    onChange={setQuantity}
                    productName={productName}
                    productEAN={productEAN}
                    onConfirm={onConfirm}
                    onClose={() => onOpenChange(false)}
                />
            </DrawerContent>
        </Drawer>
    );
}
