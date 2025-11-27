import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useHaptic } from '@/hooks/useHaptic';

interface BarcodeScannerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (code: string) => void;
}

export function BarcodeScanner({ open, onOpenChange, onScan }: BarcodeScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [scannedCode, setScannedCode] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const readerElementId = 'barcode-reader';
    const { trigger } = useHaptic();

    useEffect(() => {
        if (open && !scannerRef.current && !permissionDenied) {
            initScanner();
        }

        return () => {
            stopScanner();
        };
    }, [open, permissionDenied]);

    const requestCameraPermission = async () => {
        try {
            // Primero intentar obtener permisos explícitamente
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });

            // Si se obtienen, detener el stream inmediatamente
            stream.getTracks().forEach(track => track.stop());

            return true;
        } catch (err) {
            console.error('Error requesting camera permission:', err);

            if (err instanceof DOMException) {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setPermissionDenied(true);
                    setError('Permisos de cámara denegados. Por favor, habilita los permisos en la configuración de tu navegador.');
                } else if (err.name === 'NotFoundError') {
                    setError('No se encontró ninguna cámara en tu dispositivo.');
                } else if (err.name === 'NotReadableError') {
                    setError('La cámara está siendo usada por otra aplicación.');
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

            // Solicitar permisos primero
            const hasPermission = await requestCameraPermission();

            if (!hasPermission) {
                return;
            }

            const scanner = new Html5Qrcode(readerElementId);
            scannerRef.current = scanner;

            const config = {
                fps: 15, // Increased FPS for faster scanning
                qrbox: { width: 280, height: 280 }, // Larger scanning area
                aspectRatio: 1.0,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                },
                formatsToSupport: [
                    0, // QR_CODE
                    1, // AZTEC
                    2, // CODABAR
                    3, // CODE_39
                    4, // CODE_93
                    5, // CODE_128
                    6, // DATA_MATRIX
                    7, // MAXICODE
                    8, // ITF
                    9, // EAN_13
                    10, // EAN_8
                    11, // PDF_417
                    12, // RSS_14
                    13, // RSS_EXPANDED
                    14, // UPC_A
                    15, // UPC_E
                    16, // UPC_EAN_EXTENSION
                ],
            };

            await scanner.start(
                { facingMode: 'environment' },
                config,
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => {
                    // Ignorar errores de escaneo continuo
                }
            );

            setIsScanning(true);
            toast.success('Cámara iniciada');
        } catch (error) {
            console.error('Error starting scanner:', error);

            if (error instanceof Error) {
                if (error.message.includes('Permission')) {
                    setPermissionDenied(true);
                    setError('Permisos de cámara denegados. Por favor, habilita los permisos en la configuración de tu navegador.');
                } else {
                    setError('Error al iniciar la cámara. Verifica que hayas dado permisos y que no esté siendo usada por otra aplicación.');
                }
            }

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
        setScannedCode(code);

        // Vibración de feedback
        trigger('success');

        // Esperar un momento para mostrar el feedback visual
        setTimeout(() => {
            onScan(code);
            handleClose();
        }, 800);
    };

    const handleClose = async () => {
        await stopScanner();
        setScannedCode(null);
        setError(null);
        setPermissionDenied(false);
        onOpenChange(false);
    };

    const handleRetry = () => {
        setError(null);
        setPermissionDenied(false);
        initScanner();
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
                        {error ? 'Hubo un problema al acceder a la cámara' : 'Apunta la cámara al código de barras del producto'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Contenedor del scanner */}
                    {!error && (
                        <div className="relative rounded-lg overflow-hidden bg-black min-h-[300px]">
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
                    )}

                    {/* Mensaje de error */}
                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-destructive mb-2">Error de Cámara</h4>
                                    <p className="text-sm text-muted-foreground mb-4">{error}</p>

                                    {permissionDenied && (
                                        <div className="bg-muted/50 rounded-lg p-3 mb-4">
                                            <p className="text-xs text-muted-foreground mb-2 font-semibold">
                                                Cómo habilitar permisos:
                                            </p>
                                            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                                <li>Chrome: Toca el ícono de candado en la barra de dirección</li>
                                                <li>Safari: Ve a Configuración {'>'} Safari {'>'} Cámara</li>
                                                <li>Firefox: Toca el ícono de información en la barra de dirección</li>
                                            </ul>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleRetry}
                                        variant="outline"
                                        size="sm"
                                        className="w-full"
                                    >
                                        Reintentar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Instrucciones */}
                    {!error && (
                        <div className="bg-muted/50 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground text-center">
                                Mantén el código de barras dentro del cuadro de escaneo
                            </p>
                            <p className="text-xs text-muted-foreground text-center mt-2">
                                Funciona con códigos EAN, UPC, QR y más
                            </p>
                        </div>
                    )}

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
