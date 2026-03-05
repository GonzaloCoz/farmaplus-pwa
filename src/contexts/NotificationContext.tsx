
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useUser } from './UserContext';
import { Notification, notificationService } from '@/services/notifications.service';
import { notify } from '@/lib/notifications';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    // Load initial notifications
    useEffect(() => {
        if (!user?.id) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        const loadNotifications = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50); // Last 50 notifications

            if (error) {
                console.error("Error loading notifications:", error);
            } else {
                setNotifications(data as unknown as Notification[]);
            }
            setLoading(false);
        };

        loadNotifications();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newNotif = payload.new as Notification;
                        setNotifications(prev => [newNotif, ...prev]);
                        // Show custom notification toast
                        const notifType = newNotif.type || 'info';
                        const notifyFn = notifType === 'error' ? notify.error
                            : notifType === 'warning' ? notify.warning
                                : notifType === 'success' ? notify.success
                                    : notify.info;
                        notifyFn(newNotif.title, newNotif.message);
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as Notification;
                        setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
                    } else if (payload.eventType === 'DELETE') {
                        const deleted = payload.old as Notification;
                        setNotifications(prev => prev.filter(n => n.id !== deleted.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        try {
            await notificationService.markAsRead(id);
        } catch (e) {
            // Revert if error? For now simple log
            console.error("Error marking as read", e);
        }
    };

    const markAllAsRead = async () => {
        // Optimistic
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        try {
            await notificationService.markAllAsRead();
        } catch (e) {
            console.error("Error marking all as read", e);
        }
    };

    const deleteNotification = async (id: string) => {
        // Optimistic removal
        setNotifications(prev => prev.filter(n => n.id !== id));
        try {
            await notificationService.deleteNotification(id);
        } catch (e) {
            console.error("Error deleting notification", e);
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            loading
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
