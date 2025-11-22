import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface BarcodeScannerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (code: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [scannedCode, setScannedCode] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const readerElementId = 'barcode-reader';

    useEffect(() => {
        if (open && !scannerRef.current) {
            initScanner();
        }

        return () => {
            stopScanner();
        };
    }, [open]);

    const initScanner = async () => {
        try {
            const scanner = new Html5Qrcode(readerElementId);
            scannerRef.current = scanner;

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
            };

            await scanner.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignorar errores de escaneo continuo
                    console.debug('Scan error:', errorMessage);
                }
            );

            setIsScanning(true);
        } catch (error) {
            console.error('Error starting scanner:', error);
            toast.error('Error al iniciar la cámara', {
                description: 'Verifica que hayas dado permisos de cámara',
            });
            onOpenChange(false);
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current && isScanning) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
                scannerRef.current = null;
                setIsScanning(false);
            } catch (error) {
                console.error('Error stopping scanner:', error);
            }
        }
    };

    const handleScanSuccess = (code: string) => {
        setScannedCode(code);

        // Vibración de feedback (si está disponible)
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        // Esperar un momento para mostrar el feedback visual
        setTimeout(() => {
            onScan(code);
            handleClose();
        }, 800);
    };

    const handleClose = async () => {
        await stopScanner();
        setScannedCode(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5 text-primary" />
                        Escanear Código de Barras
                    </DialogTitle>
                    <DialogDescription>
                        Apunta la cámara al código de barras del producto
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Contenedor del scanner */}
                    <div className="relative rounded-lg overflow-hidden bg-black">
                        <div id={readerElementId} className="w-full" />

                        {/* Overlay de éxito */}
                        <AnimatePresence>
                            {scannedCode && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-success/90 flex items-center justify-center"
                                >
                                    <div className="text-center text-white">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', duration: 0.5 }}
                                        >
                                            <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
                                        </motion.div>
                                        <p className="text-xl font-semibold">¡Código detectado!</p>
                                        <p className="text-sm mt-2 font-mono">{scannedCode}</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Instrucciones */}
                    <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground text-center">
                            Mantén el código de barras dentro del cuadro de escaneo
                        </p>
                    </div>

                    {/* Botón de cerrar */}
                    <Button
                        onClick={handleClose}
                        variant="outline"
                        className="w-full"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
