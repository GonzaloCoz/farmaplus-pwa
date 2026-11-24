import { useEffect, useRef } from 'react';

interface HardwareScannerOptions {
    onScan: (code: string) => void;
    minChars?: number;
    maxInterval?: number;
    stopPropagation?: boolean;
}

/**
 * Hook to listen for rapid keystroke sequences typical of hardware scanners.
 * 
 * Uses a ref for the onScan callback to prevent listener churn when the
 * callback changes on every render (e.g. inline arrow functions). This
 * ensures the keydown and zebraScan listeners are registered exactly once
 * and are never torn down mid-scan, which was causing missed scans on
 * Zebra devices.
 */
export function useHardwareScanner({
    onScan,
    minChars = 8,
    maxInterval = 100,
    stopPropagation = true
}: HardwareScannerOptions) {
    const bufferRef = useRef<string>('');
    const lastKeyTimeRef = useRef<number>(0);
    const onScanRef = useRef(onScan);

    // Keep the onScan ref always pointing to the latest callback
    // without re-registering event listeners.
    useEffect(() => {
        onScanRef.current = onScan;
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Priority: Clear buffer on Escape
            if (e.key === 'Escape') {
                bufferRef.current = '';
                return;
            }

            // Ignore non-character keys (except Enter)
            if (e.key.length > 1 && e.key !== 'Enter') return;

            const active = document.activeElement;
            const isTextInput = active instanceof HTMLInputElement
                && (active.type === 'text' || active.type === 'search' || active.type === 'number' || active.type === 'tel' || active.type === 'password');
            const isTextArea = active instanceof HTMLTextAreaElement;
            const inputHasFocus = isTextInput || isTextArea;

            const now = Date.now();
            const interval = now - lastKeyTimeRef.current;
            lastKeyTimeRef.current = now;

            if (e.key === 'Enter') {
                const finalCode = bufferRef.current.trim();
                console.log(`[Scanner] Enter pressed. Buffer: "${finalCode}"`);
                if (finalCode.length >= minChars) {
                    if (stopPropagation) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                    onScanRef.current(finalCode);
                }
                bufferRef.current = '';
                return;
            }

            // If the interval between keys is too long, it's probably manual typing.
            // But we keep it if it's the start of a scan.
            if (interval > maxInterval && bufferRef.current !== '') {
                console.log(`[Scanner] Interval ${interval}ms exceeded. Clearing buffer.`);
                bufferRef.current = '';
            }

            // Append new key
            if (!inputHasFocus) {
                // Intercept keys "behind the scenes"
                e.preventDefault();
                e.stopPropagation();
            }
            
            bufferRef.current += e.key;
            // console.log(`[Scanner] Key: ${e.key}, Buffer: ${bufferRef.current}`);

            // Safety limit to prevent buffer overflow
            if (bufferRef.current.length > 50) {
                bufferRef.current = bufferRef.current.slice(-50);
            }
        };

        // 2. Listener for custom 'zebraScan' event
        const handleZebraScan = (e: any) => {
            const code = e.detail?.code || e.detail?.barcode || e.detail;
            console.log(`[Scanner] Zebra intent received: ${code}`);
            if (code && typeof code === 'string') {
                onScanRef.current(code.trim());
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('zebraScan', handleZebraScan as any);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('zebraScan', handleZebraScan as any);
        };
    }, [minChars, maxInterval, stopPropagation]);
}
