import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTabMetaForPath } from '@/config/tabConfig';

export interface WindowInstance {
    id: string;
    path: string;
    title: string;
    icon?: React.ReactNode;
    isClosable?: boolean;
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
    const location = useLocation();
    const navigate = useNavigate();
    const switchingToId = useRef<string | null>(null);

    const [windows, setWindows] = useState<WindowInstance[]>(() => {
        let hashPath = typeof window !== 'undefined' && window.location.hash ? window.location.hash.replace(/^#/, '') : '';
        let initialPath = hashPath || location.pathname || '/';
        if (initialPath === '/login' || initialPath === '/logout') initialPath = '/';
        if (!initialPath.startsWith('/')) initialPath = '/' + initialPath;

        const { title, icon } = getTabMetaForPath(initialPath);
        return [{
            id: crypto.randomUUID(),
            path: initialPath,
            title,
            icon,
            isClosable: true
        }];
    });

    const [activeWindowId, setActiveWindowId] = useState<string | null>(() => windows[0]?.id || null);

    // Sync active window metadata whenever location.pathname changes (internal navigation only)
    useEffect(() => {
        // Prevent tab switch navigation from erroneously renaming the previous tab
        if (switchingToId.current) {
            if (activeWindowId === switchingToId.current) {
                switchingToId.current = null;
            }
            return;
        }

        if (!activeWindowId) return;

        setWindows(prev => {
            const activeWin = prev.find(w => w.id === activeWindowId);
            if (!activeWin || activeWin.path === location.pathname) return prev;

            const meta = getTabMetaForPath(location.pathname);
            return prev.map(w =>
                w.id === activeWindowId
                    ? { ...w, path: location.pathname, title: meta.title, icon: meta.icon }
                    : w
            );
        });
    }, [location.pathname, activeWindowId]);

    const openWindow = useCallback((path: string, customTitle?: string, customIcon?: React.ReactNode, forceNew: boolean = false) => {
        const meta = getTabMetaForPath(path);
        const title = customTitle || meta.title;
        const icon = customIcon || meta.icon;

        setWindows(prev => {
            if (!forceNew) {
                const existing = prev.find(w => w.path === path);
                if (existing) {
                    switchingToId.current = existing.id;
                    setActiveWindowId(existing.id);
                    navigate(existing.path);
                    return prev;
                }
            }
            const id = crypto.randomUUID();
            switchingToId.current = id;
            setActiveWindowId(id);
            navigate(path);
            return [...prev, { id, path, title, icon, isClosable: true }];
        });
    }, [navigate]);

    const closeWindow = useCallback((id: string) => {
        setWindows(prev => {
            const winToClose = prev.find(w => w.id === id);
            if (winToClose && winToClose.isClosable === false) return prev;

            const index = prev.findIndex(w => w.id === id);
            const newWindows = prev.filter(w => w.id !== id);

            if (activeWindowId === id) {
                if (newWindows.length > 0) {
                    const nextActive = newWindows[index] || newWindows[index - 1] || newWindows[0];
                    switchingToId.current = nextActive.id;
                    setActiveWindowId(nextActive.id);
                    navigate(nextActive.path);
                } else {
                    const fallbackId = crypto.randomUUID();
                    const meta = getTabMetaForPath('/');
                    switchingToId.current = fallbackId;
                    setActiveWindowId(fallbackId);
                    navigate('/');
                    return [{ id: fallbackId, path: '/', title: meta.title, icon: meta.icon, isClosable: true }];
                }
            }
            return newWindows;
        });
    }, [activeWindowId, navigate]);

    const setActiveWindow = useCallback((id: string) => {
        if (id === activeWindowId) return;
        const target = windows.find(w => w.id === id);
        if (!target) return;
        switchingToId.current = id;
        setActiveWindowId(id);
        if (target.path !== location.pathname) {
            navigate(target.path);
        }
    }, [activeWindowId, windows, location.pathname, navigate]);

    const updateWindowPath = useCallback((id: string, path: string) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, path } : w));
    }, []);

    const updateWindowMeta = useCallback((id: string, title: string, icon: React.ReactNode) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, title, icon } : w));
    }, []);

    const closeAllWindows = useCallback(() => {
        const id = crypto.randomUUID();
        const meta = getTabMetaForPath('/');
        switchingToId.current = id;
        setWindows([{ id, path: '/', title: meta.title, icon: meta.icon, isClosable: true }]);
        setActiveWindowId(id);
        navigate('/');
    }, [navigate]);

    return (
        <WindowContext.Provider value={{
            windows,
            activeWindowId,
            openWindow,
            closeWindow,
            setActiveWindow,
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
