import { useEffect, useRef } from 'react';

interface HardwareScannerOptions {
    onScan: (code: string) => void;
    minChars?: number;
    maxInterval?: number;
}

/**
 * Hook to listen for rapid keystroke sequences typical of hardware scanners.
 */
export function useHardwareScanner({
    onScan,
    minChars = 8,
    maxInterval = 50
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
                // If it's a valid code based on length and timing
                // OR if it's very long (scanners often send Enter at the end)
                if (finalCode.length >= minChars) {
                    onScan(finalCode);
                }
                bufferRef.current = '';
                return;
            }

            // If the interval between keys is too long, it's probably manual typing
            if (interval > maxInterval && bufferRef.current !== '') {
                bufferRef.current = '';
            }

            bufferRef.current += e.key;

            // Safety limit to prevent buffer overflow
            if (bufferRef.current.length > 50) {
                bufferRef.current = bufferRef.current.slice(-50);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onScan, minChars, maxInterval]);
}
