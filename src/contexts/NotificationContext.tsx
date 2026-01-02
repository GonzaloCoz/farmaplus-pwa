
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useUser } from './UserContext';
import { Notification, notificationService } from '@/services/notifications.service';
import { toast } from 'sonner';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
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
                        // Show Toast
                        toast(newNotif.title, {
                            description: newNotif.message,
                            action: {
                                label: "Ver",
                                onClick: () => console.log("Navigate to notif", newNotif)
                            },
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as Notification;
                        setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
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

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
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
