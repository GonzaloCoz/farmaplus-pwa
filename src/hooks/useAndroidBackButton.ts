import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';

interface BackButtonOptions {
    onBack?: () => boolean | void; // Return true to prevent default
    isEnabled?: boolean;
}

/**
 * Hook to handle the Android hardware back button via Capacitor.
 * 
 * Logic:
 * 1. If a custom onBack is provided and returns true, stop.
 * 2. If canGoBack is true, go back in history.
 * 3. Fallback: navigate(-1)
 */
export function useAndroidBackButton({ onBack, isEnabled = true }: BackButtonOptions = {}) {
    const navigate = useNavigate();

    useEffect(() => {
        if (!isEnabled) return;

        const handleBackButton = async (data: { canGoBack: boolean }) => {
            // Priority 1: Custom logic (closing drawers, etc.)
            if (onBack) {
                const consumed = onBack();
                if (consumed === true) return;
            }

            // Priority 2: History navigation
            if (data.canGoBack) {
                window.history.back();
            } else {
                // Priority 3: Navigate up or let the app minimize if at the very start
                // (navigate(-1) is usually enough for HashRouter)
                navigate(-1);
            }
        };

        const listener = App.addListener('backButton', handleBackButton);

        return () => {
            listener.then(l => l.remove());
        };
    }, [onBack, isEnabled, navigate]);
}
