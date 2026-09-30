import { useEffect, useState, useCallback } from 'react';

export type AppTint = 'neutral' | 'blue' | 'indigo' | 'emerald' | 'violet' | 'warm' | 'rose';

export interface TintOption {
    id: AppTint;
    label: string;
    color: string; // Preview color
    description: string;
}

export const TINT_OPTIONS: TintOption[] = [
    { id: 'neutral', label: 'Neutro', color: '#64748B', description: 'Slate balanceado predeterminado' },
    { id: 'blue', label: 'Azul Hielo', color: '#3B82F6', description: 'Tono frío fresco y profesional' },
    { id: 'indigo', label: 'Índigo', color: '#6366F1', description: 'Azul profundo moderno' },
    { id: 'emerald', label: 'Esmeralda', color: '#10B981', description: 'Menta y verde clínico sutil' },
    { id: 'violet', label: 'Violeta', color: '#8B5CF6', description: 'Lavanda suave y elegante' },
    { id: 'warm', label: 'Cálido', color: '#F59E0B', description: 'Arena y ámbar acogedor' },
    { id: 'rose', label: 'Rosa', color: '#F43F5E', description: 'Carmesí sutil y distinguido' },
];

const TINT_STORAGE_KEY = 'app-tint';

export function useTint() {
    const [tint, setTintState] = useState<AppTint>(() => {
        const stored = localStorage.getItem(TINT_STORAGE_KEY);
        return (stored as AppTint) || 'neutral';
    });

    const applyTint = useCallback((t: AppTint) => {
        const root = document.documentElement;
        if (t === 'neutral') {
            root.removeAttribute('data-tint');
        } else {
            root.setAttribute('data-tint', t);
        }
    }, []);

    const setTint = useCallback((t: AppTint) => {
        setTintState(t);
        localStorage.setItem(TINT_STORAGE_KEY, t);
        applyTint(t);
        window.dispatchEvent(new Event('tint-change'));
    }, [applyTint]);

    useEffect(() => {
        applyTint(tint);

        const handleStorageOrCustom = () => {
            const stored = (localStorage.getItem(TINT_STORAGE_KEY) as AppTint) || 'neutral';
            setTintState(stored);
            applyTint(stored);
        };

        window.addEventListener('tint-change', handleStorageOrCustom);
        window.addEventListener('storage', handleStorageOrCustom);

        return () => {
            window.removeEventListener('tint-change', handleStorageOrCustom);
            window.removeEventListener('storage', handleStorageOrCustom);
        };
    }, [tint, applyTint]);

    return {
        tint,
        setTint,
        tints: TINT_OPTIONS,
    };
}
