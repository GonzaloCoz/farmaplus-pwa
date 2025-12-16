import React, { createContext, useContext, useState, useEffect } from 'react';

export type NotificationPosition = 'top-right' | 'bottom-right' | 'bottom-center';
export type ReminderType = 'all' | 'center-only' | 'none';

interface NotificationPreferences {
    position: NotificationPosition;
    reminderType: ReminderType;
}

interface NotificationPreferencesContextType {
    preferences: NotificationPreferences;
    setPosition: (position: NotificationPosition) => void;
    setReminderType: (type: ReminderType) => void;
}

const NotificationPreferencesContext = createContext<NotificationPreferencesContextType | undefined>(undefined);

const STORAGE_KEY = 'farmaplus_notification_preferences';

const defaultPreferences: NotificationPreferences = {
    position: 'bottom-right',
    reminderType: 'center-only',
};

export function NotificationPreferencesProvider({ children }: { children: React.ReactNode }) {
    const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return defaultPreferences;
            }
        }
        return defaultPreferences;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    }, [preferences]);

    const setPosition = (position: NotificationPosition) => {
        setPreferences(prev => ({ ...prev, position }));
    };

    const setReminderType = (reminderType: ReminderType) => {
        setPreferences(prev => ({ ...prev, reminderType }));
    };

    return (
        <NotificationPreferencesContext.Provider value={{ preferences, setPosition, setReminderType }}>
            {children}
        </NotificationPreferencesContext.Provider>
    );
}

export function useNotificationPreferences() {
    const context = useContext(NotificationPreferencesContext);
    if (!context) {
        throw new Error('useNotificationPreferences must be used within NotificationPreferencesProvider');
    }
    return context;
}
