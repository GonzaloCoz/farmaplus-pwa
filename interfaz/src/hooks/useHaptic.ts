import { useCallback } from 'react';

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export function useHaptic() {
    const trigger = useCallback((type: HapticType = 'light') => {
        // Check if the Vibration API is supported
        if (!('vibrate' in navigator)) {
            return;
        }

        // Map haptic types to vibration patterns
        const patterns: Record<HapticType, number | number[]> = {
            light: 10,
            medium: 20,
            heavy: 30,
            selection: [5, 10],
            success: [10, 50, 10],
            warning: [20, 100, 20],
            error: [30, 100, 30, 100, 30],
        };

        const pattern = patterns[type];

        try {
            if (Array.isArray(pattern)) {
                navigator.vibrate(pattern);
            } else {
                navigator.vibrate(pattern);
            }
        } catch (error) {
            console.warn('Haptic feedback failed:', error);
        }
    }, []);

    return { trigger };
}
