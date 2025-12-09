import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, CheckCircle2, AlertCircle, Layers, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useHaptic } from '@/hooks/useHaptic';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface BarcodeScannerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (code: string) => void;
    onBatchScan?: (codes: string[]) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan, onBatchScan }: BarcodeScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [scannedCode, setScannedCode] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const readerElementId = 'barcode-reader';
    const { trigger } = useHaptic();

    // Batch Mode State
    const [batchMode, setBatchMode] = useState(false);
    const [scannedItems, setScannedItems] = useState<string[]>([]);

    useEffect(() => {
        if (open && !scannerRef.current && !permissionDenied) {
            initScanner();
        }

        return () => {
            stopScanner();
        };
    }, [open, permissionDenied]);

    // Reset batch items when opening
    useEffect(() => {
        if (open) {
            setScannedItems([]);
            setBatchMode(false);
        }
    }, [open]);

    const requestCameraPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.error('Error requesting camera permission:', err);
            if (err instanceof DOMException) {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setPermissionDenied(true);
                    setError('Permisos de cámara denegados. Por favor, habilita los permisos en la configuración de tu navegador.');
                } else {
                    setError('Error al acceder a la cámara. Intenta nuevamente.');
                }
            }
            return false;
        }
    };

    const initScanner = async () => {
        try {
            setError(null);
            const hasPermission = await requestCameraPermission();
            if (!hasPermission) return;

            const scanner = new Html5Qrcode(readerElementId);
            scannerRef.current = scanner;

            const config = {
                fps: 15,
                qrbox: { width: 280, height: 280 },
                aspectRatio: 1.0,
                experimentalFeatures: { useBarCodeDetectorIfSupported: true },
            };

            await scanner.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                () => { }
            );

            setIsScanning(true);
        } catch (error) {
            console.error('Error starting scanner:', error);
            setError('Error al iniciar la cámara.');
            toast.error('Error al iniciar la cámara');
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
            } catch (error) {
                console.error('Error stopping scanner:', error);
            } finally {
                scannerRef.current = null;
                setIsScanning(false);
            }
        }
    };

    const handleScanSuccess = (code: string) => {
        // Prevent duplicate rapid scans in batch mode (simple debounce)
        if (batchMode && scannedItems.length > 0 && scannedItems[scannedItems.length - 1] === code) {
            // Optional: Allow duplicates? For now, let's debounce slightly or allow.
            // If we want to count items, we should allow duplicates but maybe with a small delay.
            // Let's just allow it for now, user can delete.
        }

        trigger('success');

        if (batchMode) {
            setScannedItems(prev => [code, ...prev]);
            setScannedCode(code);
            // Clear visual feedback quickly
            setTimeout(() => setScannedCode(null), 1000);
        } else {
            setScannedCode(code);
            setTimeout(() => {
                onScan(code);
                handleClose();
            }, 800);
        }
    };

    const handleClose = async () => {
        await stopScanner();
        setScannedCode(null);
        setError(null);
        setPermissionDenied(false);
        onOpenChange(false);
    };

    const handleFinishBatch = () => {
        if (onBatchScan) {
            onBatchScan(scannedItems);
        }
        handleClose();
    };

    const removeBatchItem = (index: number) => {
        setScannedItems(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-4 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5 text-primary" />
                        Escanear Código
                    </DialogTitle>
                    <DialogDescription>
                        {error ? 'Error de cámara' : 'Apunta al código de barras'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-4">
                    {/* Scanner View */}
                    {!error && (
                        <div className="relative rounded-lg overflow-hidden bg-black min-h-[250px] shrink-0">
                            <div id={readerElementId} className="w-full" />

                            {/* Success Overlay */}
                            <AnimatePresence>
                                {scannedCode && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 bg-success/80 flex items-center justify-center z-10"
                                    >
                                        <div className="text-center text-white">
                                            <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
                                            <p className="font-mono font-bold">{scannedCode}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Batch Mode Toggle */}
                    <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-muted-foreground" />
                            <Label htmlFor="batch-mode" className="cursor-pointer">Modo Ráfaga</Label>
                        </div>
                        <Switch
                            id="batch-mode"
                            checked={batchMode}
                            onCheckedChange={setBatchMode}
                        />
                    </div>

                    {/* Batch List */}
                    {batchMode && scannedItems.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Items Escaneados ({scannedItems.length})</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-destructive"
                                    onClick={() => setScannedItems([])}
                                >
                                    Limpiar
                                </Button>
                            </div>
                            <div className="max-h-[150px] overflow-y-auto space-y-1 border rounded-md p-2 bg-background">
                                {scannedItems.map((code, index) => (
                                    <div key={index} className="flex items-center justify-between text-sm p-1 hover:bg-muted rounded">
                                        <span className="font-mono">{code}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeBatchItem(index)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                            {error}
                            <Button onClick={() => initScanner()} variant="outline" size="sm" className="mt-2 w-full">
                                Reintentar
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 pt-2 border-t bg-muted/20 flex-row gap-2 sm:justify-end">
                    <Button variant="outline" onClick={handleClose} className="flex-1 sm:flex-none">
                        Cancelar
                    </Button>
                    {batchMode && (
                        <Button
                            onClick={handleFinishBatch}
                            disabled={scannedItems.length === 0}
                            className="flex-1 sm:flex-none"
                        >
                            Procesar ({scannedItems.length})
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
