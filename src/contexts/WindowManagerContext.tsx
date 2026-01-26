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
    const [windows, setWindows] = useState<WindowInstance[]>([]);
    const [activeWindowId, setActiveWindowId] = useState<string | null>(null);

    // Initial window (e.g. Dashboard)
    useEffect(() => {
        if (windows.length === 0) {
            const { title, icon } = getTabMetaForPath('/');
            openWindow('/', title, icon, false);
        }
    }, [windows.length]);

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
            path,
            title: title || meta.title,
            icon: icon || meta.icon
        };
        setWindows(prev => {
            // Final check to avoid race conditions/duplicates in mount
            if (!forceNew && prev.find(w => w.path === path)) return prev;
            return [...prev, newWindow];
        });
        setActiveWindowId(id);
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
