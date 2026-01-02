import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto' | 'system';

const THEME_STORAGE_KEY = 'theme-mode';

export function useTheme() {
    const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        return (stored as ThemeMode) || 'system';
    });

    const getSystemTheme = (): 'light' | 'dark' => {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const getAutoTheme = (): 'light' | 'dark' => {
        const hour = new Date().getHours();
        // Dark mode from 8 PM to 6 AM
        return (hour >= 20 || hour < 6) ? 'dark' : 'light';
    };

    const getEffectiveTheme = (mode: ThemeMode): 'light' | 'dark' => {
        switch (mode) {
            case 'light':
                return 'light';
            case 'dark':
                return 'dark';
            case 'auto':
                return getAutoTheme();
            case 'system':
                return getSystemTheme();
            default:
                return 'light';
        }
    };

    const applyTheme = (mode: ThemeMode) => {
        const effectiveTheme = getEffectiveTheme(mode);
        const root = window.document.documentElement;

        root.classList.remove('light', 'dark');
        root.classList.add(effectiveTheme);
    };

    const setThemeMode = (mode: ThemeMode) => {
        setThemeModeState(mode);
        localStorage.setItem(THEME_STORAGE_KEY, mode);
        applyTheme(mode);
    };

    useEffect(() => {
        applyTheme(themeMode);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (themeMode === 'system') {
                applyTheme('system');
            }
        };

        mediaQuery.addEventListener('change', handleChange);

        // Auto mode: check every minute
        let interval: NodeJS.Timeout | null = null;
        if (themeMode === 'auto') {
            interval = setInterval(() => {
                applyTheme('auto');
            }, 60000); // Check every minute
        }

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            if (interval) clearInterval(interval);
        };
    }, [themeMode]);

    // Legacy support for old theme toggle
    const theme = getEffectiveTheme(themeMode);
    const setTheme = (t: 'light' | 'dark') => setThemeMode(t);
    const toggleTheme = () => setThemeMode(theme === 'light' ? 'dark' : 'light');

    return {
        theme,
        setTheme,
        toggleTheme,
        themeMode,
        setThemeMode,
        effectiveTheme: theme
    };
}
