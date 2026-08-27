import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTabMetaForPath } from '@/config/tabConfig';
import { useUser } from './UserContext';
import { calendarService } from '@/services/calendarService';

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
    const { user } = useUser();
    const location = useLocation();
    const navigate = useNavigate();
    const isNavigationTriggeredByContext = useRef(false);
    const lastProcessedPath = useRef(location.pathname);

    const [windows, setWindows] = useState<WindowInstance[]>(() => {
        let hashPath = typeof window !== 'undefined' && window.location.hash ? window.location.hash.replace(/^#/, '') : '';
        let initialPath = hashPath || location.pathname || '/';
        if (initialPath === '/login' || initialPath === '/logout') initialPath = '/';
        if (!initialPath.startsWith('/')) initialPath = '/' + initialPath;

        const { title, icon } = getTabMetaForPath(initialPath);
        return [{
            id: uuidv4(),
            path: initialPath,
            title,
            icon,
            isClosable: true
        }];
    });
    const [activeWindowId, setActiveWindowId] = useState<string | null>(() => windows[0]?.id || null);

    // 1. Sync Active Window Changes -> Global URL
    useEffect(() => {
        const activeWin = windows.find(w => w.id === activeWindowId);
        if (activeWin && activeWin.path !== location.pathname) {
            isNavigationTriggeredByContext.current = true;
            lastProcessedPath.current = activeWin.path;
            navigate(activeWin.path);
        }
    }, [activeWindowId]); // Only when active tab SWITCHES

    // 2. Sync Global URL -> Active Window Path
    useEffect(() => {
        // Skip if this change was triggered by our own context (tab switch)
        if (isNavigationTriggeredByContext.current) {
            isNavigationTriggeredByContext.current = false;
            return;
        }

        if (lastProcessedPath.current === location.pathname) return;
        lastProcessedPath.current = location.pathname;

        if (activeWindowId) {
            const activeWin = windows.find(w => w.id === activeWindowId);
            if (activeWin) {
                // PROTECTION: If active window is FIXED (e.g. reminder), DO NOT overwrite its path.
                // Instead, find or create a new window for the new path.
                if (activeWin.isClosable === false) {
                    const existing = windows.find(w => w.path === location.pathname);
                    if (existing) {
                        setActiveWindowId(existing.id);
                    } else {
                        const id = uuidv4();
                        const meta = getTabMetaForPath(location.pathname);
                        setWindows(prev => [...prev, {
                            id,
                            path: location.pathname,
                            title: meta.title,
                            icon: meta.icon,
                            isClosable: true
                        }]);
                        setActiveWindowId(id);
                    }
                    return;
                }

                // Normal behavior: update current active window's path
                if (activeWin.path !== location.pathname) {
                    const meta = getTabMetaForPath(location.pathname);
                    setWindows(prev => prev.map(w =>
                        w.id === activeWindowId
                            ? { ...w, path: location.pathname, title: meta.title, icon: meta.icon }
                            : w
                    ));
                }
            }
        }
    }, [location.pathname, activeWindowId, windows]);

    // 3. Auto-inject Inventory Reminder
    useEffect(() => {
        let isMounted = true;
        async function checkReminders() {
            if (!user?.branchName || user.role === 'admin') return;

            try {
                const events = await calendarService.getEvents(user.branchName, false);
                if (!isMounted) return;
                
                const today = new Date().toISOString().split('T')[0];
                const hasUpcoming = events.some(e => e.date >= today);

                if (hasUpcoming) {
                    setWindows(prev => {
                        const exists = prev.find(w => w.path === '/recordatorio-inventario');
                        if (exists) {
                            if (prev[0].path === '/recordatorio-inventario') return prev;
                            const other = prev.filter(w => w.path !== '/recordatorio-inventario');
                            return [exists, ...other];
                        }

                        const meta = getTabMetaForPath('/recordatorio-inventario');
                        const reminderWindow: WindowInstance = {
                            id: 'system-reminder',
                            path: '/recordatorio-inventario',
                            title: meta.title,
                            icon: meta.icon,
                            isClosable: false
                        };
                        return [reminderWindow, ...prev];
                    });
                } else {
                    setWindows(prev => {
                        const newWins = prev.filter(w => w.path !== '/recordatorio-inventario');
                        if (activeWindowId === 'system-reminder' && newWins.length > 0) {
                            setActiveWindowId(newWins[0].id);
                        }
                        return newWins;
                    });
                }
            } catch (error) {
                console.error("Error injectando recordatorio:", error);
            }
        }
        checkReminders();
        return () => { isMounted = false; };
    }, [user?.branchName, user?.role]); // removed activeWindowId from deps to avoid re-triggering reorder on every switch

    const openWindow = useCallback((path: string, title?: string, icon?: React.ReactNode, forceNew: boolean = true) => {
        const id = uuidv4();
        const meta = getTabMetaForPath(path);
        const newWindow: WindowInstance = {
            id,
            path,
            title: title || meta.title,
            icon: icon || meta.icon,
            isClosable: true
        };

        setWindows(prev => {
            if (!forceNew) {
                const existing = prev.find(w => w.path === path);
                if (existing) {
                    setActiveWindowId(existing.id);
                    return prev;
                }
            }
            setActiveWindowId(id);
            return [...prev, newWindow];
        });
    }, []);

    const closeWindow = useCallback((id: string) => {
        setWindows(prev => {
            const winToClose = prev.find(w => w.id === id);
            if (winToClose && winToClose.isClosable === false) return prev;

            const index = prev.findIndex(w => w.id === id);
            const newWindows = prev.filter(w => w.id !== id);

            if (activeWindowId === id) {
                if (newWindows.length > 0) {
                    const nextActive = newWindows[index] || newWindows[index - 1];
                    setActiveWindowId(nextActive.id);
                } else {
                    setActiveWindowId(null);
                }
            }
            return newWindows;
        });
    }, [activeWindowId]);

    const updateWindowPath = useCallback((id: string, path: string) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, path } : w));
    }, []);

    const updateWindowMeta = useCallback((id: string, title: string, icon: React.ReactNode) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, title, icon } : w));
    }, []);

    const closeAllWindows = useCallback(() => {
        setWindows(prev => {
            const remaining = prev.filter(w => w.isClosable === false);
            if (remaining.length > 0) {
                setActiveWindowId(remaining[0].id);
                return remaining;
            } else {
                const id = uuidv4();
                const meta = getTabMetaForPath('/');
                setActiveWindowId(id);
                return [{ id, path: '/', title: meta.title, icon: meta.icon, isClosable: true }];
            }
        });
    }, []);

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
