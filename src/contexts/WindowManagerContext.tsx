import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getTabMetaForPath } from '@/config/tabConfig';

export interface WindowInstance {
    id: string;
    path: string;
    title: string;
    icon?: React.ReactNode;
}

interface WindowManagerContextType {
    windows: WindowInstance[];
    activeWindowId: string | null;
    openWindow: (path: string, title?: string, icon?: React.ReactNode, forceNew?: boolean) => void;
    closeWindow: (id: string) => void;
    setActiveWindow: (id: string) => void;
    updateWindowPath: (id: string, path: string) => void;
    updateWindowMeta: (id: string, title: string, icon: React.ReactNode) => void;
    closeAllWindows: () => void;
}

const WindowContext = createContext<WindowManagerContextType | undefined>(undefined);

export const WindowManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [windows, setWindows] = useState<WindowInstance[]>(() => {
        // Inicialización síncrona para evitar flash de carga y race conditions
        let initialPath = window.location.pathname === '/' ? '/' : window.location.pathname;

        // No crear ventanas para rutas que no son de la app (como /login)
        if (initialPath === '/login' || initialPath === '/logout') {
            initialPath = '/';
        }

        const { title, icon } = getTabMetaForPath(initialPath);
        return [{
            id: uuidv4(),
            path: initialPath,
            title,
            icon
        }];
    });
    const [activeWindowId, setActiveWindowId] = useState<string | null>(() => windows[0]?.id || null);

    // No necesitamos el useEffect inicial ya que inicializamos en el state

    const openWindow = (path: string, title?: string, icon?: React.ReactNode, forceNew: boolean = true) => {
        // If not forcing new, check if a window with this path exists
        if (!forceNew) {
            const existing = windows.find(w => w.path === path);
            if (existing) {
                setActiveWindowId(existing.id);
                return;
            }
        }

        const id = uuidv4();
        const meta = getTabMetaForPath(path);
        const newWindow: WindowInstance = {
            id,
            path: path,
            title: title || meta.title,
            icon: icon || meta.icon
        };

        setWindows(prev => {
            // Final check to avoid race conditions/duplicates in mount
            const existing = prev.find(w => w.path === path);
            if (!forceNew && existing) {
                // Use current ID instead of creating a ghost one
                setActiveWindowId(existing.id);
                return prev;
            }
            setActiveWindowId(id);
            return [...prev, newWindow];
        });
    };

    const closeWindow = (id: string) => {
        setWindows(prev => {
            const index = prev.findIndex(w => w.id === id);
            const newWindows = prev.filter(w => w.id !== id);

            if (activeWindowId === id) {
                if (newWindows.length > 0) {
                    const nextIndex = Math.max(0, index - 1);
                    setActiveWindowId(newWindows[nextIndex].id);
                } else {
                    setActiveWindowId(null);
                }
            }
            return newWindows;
        });
    };

    const updateWindowPath = (id: string, path: string) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, path } : w));
    };

    const updateWindowMeta = (id: string, title: string, icon: React.ReactNode) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, title, icon } : w));
    };

    const closeAllWindows = () => {
        setWindows([]);
        setActiveWindowId(null);
        // The useEffect will kick in and create the default Dashboard window
    };

    return (
        <WindowContext.Provider value={{
            windows,
            activeWindowId,
            openWindow,
            closeWindow,
            setActiveWindow: setActiveWindowId,
            updateWindowPath,
            updateWindowMeta,
            closeAllWindows
        }}>
            {children}
        </WindowContext.Provider>
    );
};

export const useWindowManager = () => {
    const context = useContext(WindowContext);
    if (!context) {
        throw new Error('useWindowManager must be used within a WindowManagerProvider');
    }
    return context;
};
