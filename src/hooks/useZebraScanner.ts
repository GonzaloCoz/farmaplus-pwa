import { useEffect, useRef } from 'react';

// Web Audio API Sound Synthesizer for Zebra Handheld
const playSound = (freq: number, duration: number, type: OscillatorType = 'sine', secondFreq?: number) => {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (secondFreq) {
            osc.frequency.exponentialRampToValueAtTime(secondFreq, ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        console.warn("Audio Context playback error:", e);
    }
};

export const zebraAudio = {
    playSuccess: () => playSound(880, 0.08, 'sine'), // Short high beep (880Hz)
    playError: () => {
        playSound(220, 0.15, 'sawtooth'); // Low buzz (220Hz)
        setTimeout(() => playSound(180, 0.2, 'sawtooth'), 160);
    },
    playModeChange: () => {
        playSound(523.25, 0.06, 'sine'); // C5
        setTimeout(() => playSound(659.25, 0.08, 'sine'), 70); // E5
    }
};

interface UseZebraScannerOptions {
    onScan: (barcode: string) => void;
    enabled?: boolean;
}

export function useZebraScanner({ onScan, enabled = true }: UseZebraScannerOptions) {
    const bufferRef = useRef<string>('');
    const lastKeyTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const now = Date.now();
            const timeDiff = now - lastKeyTimeRef.current;
            lastKeyTimeRef.current = now;

            // Si la tecla es Enter o Tab, enviamos el buffer acumulado
            if (e.key === 'Enter' || e.key === 'Tab') {
                const scannedText = bufferRef.current.trim();
                if (scannedText.length >= 3) {
                    onScan(scannedText);
                    e.preventDefault();
                }
                bufferRef.current = '';
                return;
            }

            // Si se presiona la tecla de borrado o escape, limpiamos el buffer
            if (e.key === 'Escape' || e.key === 'Backspace') {
                bufferRef.current = '';
                return;
            }

            // Solo capturamos caracteres imprimibles (EAN13, EAN8, Code128, etc)
            if (e.key.length === 1) {
                // Si ha pasado más de 100ms desde la última tecla y no es ráfaga de escáner, reseteamos el buffer
                if (timeDiff > 100 && bufferRef.current.length > 0) {
                    bufferRef.current = '';
                }
                bufferRef.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onScan, enabled]);
}
