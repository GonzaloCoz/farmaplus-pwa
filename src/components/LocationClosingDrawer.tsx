import React, { useState, useEffect, useRef } from 'react';
import { 
    Drawer, 
    DrawerContent, 
    DrawerHeader, 
    DrawerTitle, 
    DrawerDescription, 
    DrawerFooter, 
    DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { 
    CloudUpload as CloudUploadIcon, 
    CheckCircle2 as CloudCheckIcon, 
    RotateCcw,
    AlertTriangle,
    ArrowRight,
    ArrowLeft
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';

interface LocationClosingDrawerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    locationName: string;
    stats: {
        products: number;
        units: number;
    };
    onConfirm: () => Promise<void>;
}

export function LocationClosingDrawer({ 
    isOpen, 
    onOpenChange, 
    locationName, 
    stats, 
    onConfirm 
}: LocationClosingDrawerProps) {
    const [step, setStep] = useState(1);
    const [progress, setProgress] = useState(0);
    const [isHolding, setIsHolding] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Reset state when drawer closes/opens
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setStep(1);
                setProgress(0);
                setIsHolding(false);
                setStatus('idle');
            }, 300);
        }
    }, [isOpen]);

    const startHolding = () => {
        if (status !== 'idle') return;
        setIsHolding(true);
        const startTime = Date.now();
        const duration = 3000; // 3 seconds as requested

        timerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.min((elapsed / duration) * 100, 100);
            setProgress(newProgress);

            if (newProgress >= 100) {
                stopHolding(true);
            }
        }, 30);
    };

    const stopHolding = async (completed = false) => {
        setIsHolding(false);
        if (timerRef.current) clearInterval(timerRef.current);

        if (completed) {
            setStatus('loading');
            try {
                await onConfirm();
                setStatus('success');
                setTimeout(() => onOpenChange(false), 1500);
            } catch (err) {
                setStatus('idle');
                setProgress(0);
            }
        } else if (status === 'idle') {
            setProgress(0);
        }
    };

    return (
        <Drawer open={isOpen} onOpenChange={onOpenChange}>
            <DrawerContent showBar>
                <div className="min-h-[350px] flex flex-col">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div 
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex-1 flex flex-col"
                            >
                                <DrawerHeader className="text-center">
                                    <div className="mx-auto size-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
                                        <AlertTriangle className="size-6 text-amber-500" />
                                    </div>
                                    <DrawerTitle className="text-xl">Finalizar Zona: {locationName}</DrawerTitle>
                                    <DrawerDescription className="text-sm px-6">
                                        ¿Estás seguro de que deseas cerrar este espacio? Una vez bloqueada, no podrás agregar más productos en esta sesión.
                                    </DrawerDescription>
                                </DrawerHeader>
                                
                                <div className="mt-auto p-4 flex flex-col gap-3">
                                    <Button 
                                        onClick={() => setStep(2)}
                                        className="h-12 w-full font-bold bg-primary text-primary-foreground text-sm rounded-xl py-3 group"
                                    >
                                        Continuar
                                        <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                    <DrawerClose asChild>
                                        <Button variant="ghost" className="text-muted-foreground font-medium">
                                            Cancelar
                                        </Button>
                                    </DrawerClose>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div 
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex-1 flex flex-col"
                            >
                                <DrawerHeader className="text-center">
                                    <DrawerTitle className="text-xl">Resumen de Conteo</DrawerTitle>
                                    <DrawerDescription>Verifica los totales antes de bloquear.</DrawerDescription>
                                </DrawerHeader>
                                
                                <div className="px-6 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted/40 p-4 rounded-lg border border-border/50 text-center">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1">Productos</span>
                                            <span className="text-2xl font-black">{stats.products}</span>
                                        </div>
                                        <div className="bg-muted/40 p-4 rounded-lg border border-border/50 text-center">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block mb-1">Unidades</span>
                                            <span className="text-2xl font-black">{stats.units}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                                        <InfoCircleIcon className="size-5 text-primary shrink-0 mt-0.5" />
                                        <p className="text-xs text-primary/80 leading-relaxed">
                                            Asegúrate de que no queden productos sin escanear en la zona física.
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-auto p-4 flex flex-col gap-3">
                                    <Button 
                                        onClick={() => setStep(3)}
                                        className="h-12 w-full font-bold bg-primary text-primary-foreground text-sm rounded-xl py-3 group"
                                    >
                                        Confirmar y Bloquear
                                        <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                    <Button variant="ghost" onClick={() => setStep(1)} className="text-muted-foreground font-medium">
                                        Volver
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div 
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex-1 flex flex-col items-center justify-center py-8"
                            >
                                <DrawerHeader className="text-center w-full mb-8">
                                    <DrawerTitle className="text-xl">Bloqueo Final</DrawerTitle>
                                    <DrawerDescription>Mantén presionado para cerrar {locationName}</DrawerDescription>
                                </DrawerHeader>

                                {/* Hold Button Container */}
                                <div className="relative size-40 flex items-center justify-center">
                                    {/* Progress Ring */}
                                    <svg className="absolute inset-0 size-full -rotate-90">
                                        <circle
                                            cx="80"
                                            cy="80"
                                            r="76"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            fill="transparent"
                                            className="text-muted/20"
                                        />
                                        <circle
                                            cx="80"
                                            cy="80"
                                            r="76"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            fill="transparent"
                                            strokeDasharray={477.5}
                                            strokeDashoffset={477.5 - (477.5 * progress) / 100}
                                            strokeLinecap="round"
                                            className={cn(
                                                "transition-all duration-75",
                                                status === 'success' ? "text-emerald-500" : "text-primary"
                                            )}
                                        />
                                    </svg>

                                    {/* Central Button */}
                                    <button
                                        onMouseDown={startHolding}
                                        onMouseUp={() => stopHolding(false)}
                                        onMouseLeave={() => stopHolding(false)}
                                        onTouchStart={startHolding}
                                        onTouchEnd={() => stopHolding(false)}
                                        className={cn(
                                            "relative z-10 size-32 rounded-full flex flex-col items-center justify-center transition-all duration-200 shadow-sm border-4 active:scale-95",
                                            status === 'idle' ? "bg-card border-border/50" : 
                                            status === 'loading' ? "bg-primary/10 border-primary/30" : 
                                            "bg-emerald-500/10 border-emerald-500/30"
                                        )}
                                        disabled={status !== 'idle'}
                                    >
                                        <AnimatePresence mode="wait">
                                            {status === 'idle' && (
                                                <motion.div 
                                                    key="idle"
                                                    initial={{ scale: 0.8 }} 
                                                    animate={{ scale: isHolding ? 1.2 : 1 }}
                                                    exit={{ scale: 0.8, opacity: 0 }}
                                                >
                                                    <CloudUploadIcon className={cn("size-10", isHolding ? "text-primary animate-pulse" : "text-muted-foreground")} />
                                                </motion.div>
                                            )}
                                            {status === 'loading' && (
                                                <motion.div 
                                                    key="loading"
                                                    initial={{ rotate: 0 }}
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                                >
                                                    <RotateCcw className="size-10 text-primary" />
                                                </motion.div>
                                            )}
                                            {status === 'success' && (
                                                <motion.div 
                                                    key="success"
                                                    initial={{ scale: 0.5, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                >
                                                    <CloudCheckIcon className="size-12 text-emerald-500" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {status === 'idle' && isHolding && (
                                            <span className="absolute bottom-6 text-[10px] font-bold text-primary animate-pulse">
                                                HOLD
                                            </span>
                                        )}
                                    </button>
                                </div>

                                <div className="mt-auto p-4 w-full">
                                    <Button variant="ghost" onClick={() => setStep(2)} className="w-full text-muted-foreground font-medium" disabled={status !== 'idle'}>
                                        Volver
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

function InfoCircleIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </svg>
    )
}

