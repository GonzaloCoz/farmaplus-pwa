import { useEffect, useRef } from 'react';

interface HardwareScannerOptions {
    onScan: (code: string) => void;
    minChars?: number;
    maxInterval?: number;
    stopPropagation?: boolean;
}

/**
 * Hook to listen for rapid keystroke sequences typical of hardware scanners.
 */
export function useHardwareScanner({
    onScan,
    minChars = 8,
    maxInterval = 100, // Increased from 50 to 100 for better hardware compatibility
    stopPropagation = true
}: HardwareScannerOptions) {
    const bufferRef = useRef<string>('');
    const lastKeyTimeRef = useRef<number>(0);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore non-character keys (except Enter)
            if (e.key.length > 1 && e.key !== 'Enter') return;

            const now = Date.now();
            const interval = now - lastKeyTimeRef.current;
            lastKeyTimeRef.current = now;

            if (e.key === 'Enter') {
                const finalCode = bufferRef.current.trim();
                if (finalCode.length >= minChars) {
                    if (stopPropagation) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                    onScan(finalCode);
                }
                bufferRef.current = '';
                return;
            }

            // If the interval between keys is too long, it's probably manual typing.
            // But we only clear if there's already something in the buffer.
            // A long interval for the FIRST character of a scan is normal.
            if (interval > maxInterval && bufferRef.current !== '') {
                // If the previous buffer was small, it was likely manual typing.
                // Clear it and start fresh with the new key.
                bufferRef.current = '';
            }

            // Append new key
            bufferRef.current += e.key;

            // Safety limit to prevent buffer overflow
            if (bufferRef.current.length > 50) {
                bufferRef.current = bufferRef.current.slice(-50);
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [onScan, minChars, maxInterval, stopPropagation]);
}
