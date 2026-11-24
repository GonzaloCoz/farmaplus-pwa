
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useUser } from './UserContext';
import { Notification, notificationService } from '@/services/notifications.service';
import { calendarEventsService } from '@/services/calendarEventsService';
import { notify } from '@/lib/notifications';

function getCalendarEventId(n: Notification): string | null {
    if (n.category !== 'CALENDARIO' || !n.metadata || typeof n.metadata !== 'object') {
        return null;
    }
    const eventId = (n.metadata as Record<string, unknown>).event_id;
    return typeof eventId === 'string' && eventId.length > 0 ? eventId : null;
}

function isDeletedEventNotification(n: Notification): boolean {
    if (!n.metadata || typeof n.metadata !== 'object') return false;
    return Boolean((n.metadata as Record<string, unknown>).event_deleted);
}

async function purgeOrphanNotificationRows(orphans: Notification[]): Promise<void> {
    if (orphans.length === 0) return;
    const ids = orphans.map((n) => n.id);
    try {
        await supabase.from('notifications').delete().in('id', ids);
        await Promise.all(
            orphans.map((n) => {
                const prevMeta =
                    n.metadata && typeof n.metadata === 'object' && !Array.isArray(n.metadata)
                        ? (n.metadata as Record<string, unknown>)
                        : {};
                return supabase
                    .from('notifications')
                    .update({
                        is_read: true,
                        metadata: { ...prevMeta, event_deleted: true } as Json,
                    })
                    .eq('id', n.id);
            })
        );
    } catch {
        // ignore cleanup warnings
    }
}

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

    const reconcileCalendarNotifications = useCallback(async (items: Notification[]) => {
        const visible = items.filter((n) => !isDeletedEventNotification(n));
        const hasCalendarItems = visible.some((n) => getCalendarEventId(n) !== null);
        if (!hasCalendarItems) return visible;

        try {
            const activeEvents = await calendarEventsService.list();
            const activeIds = new Set(activeEvents.map((ev) => ev.id));
            const orphans: Notification[] = [];
            const valid = visible.filter((n) => {
                const eventId = getCalendarEventId(n);
                if (!eventId) return true;
                if (activeIds.has(eventId)) return true;
                orphans.push(n);
                return false;
            });
            if (orphans.length > 0) {
                void purgeOrphanNotificationRows(orphans);
            }
            return valid;
        } catch {
            return visible;
        }
    }, []);

    // Load initial notifications
    useEffect(() => {
        if (!user?.id) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        let cancelled = false;

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
                const raw = (data as unknown as Notification[]).filter(
                    (n) => !isDeletedEventNotification(n)
                );
                if (!cancelled) setNotifications(raw);
                const reconciled = await reconcileCalendarNotifications(raw);
                if (!cancelled) setNotifications(reconciled);
            }
            if (!cancelled) setLoading(false);
        };

        void loadNotifications();

        const unsubscribeCalendar = calendarEventsService.subscribe(async () => {
            try {
                const activeEvents = await calendarEventsService.list();
                if (cancelled) return;
                const activeIds = new Set(activeEvents.map((ev) => ev.id));
                setNotifications((prev) => {
                    const orphans: Notification[] = [];
                    const next = prev.filter((n) => {
                        if (isDeletedEventNotification(n)) return false;
                        const eventId = getCalendarEventId(n);
                        if (!eventId || activeIds.has(eventId)) return true;
                        orphans.push(n);
                        return false;
                    });
                    if (orphans.length > 0) {
                        void purgeOrphanNotificationRows(orphans);
                    }
                    return next;
                });
            } catch {
                // ignore transient network errors
            }
        });

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
                        if (isDeletedEventNotification(newNotif)) return;
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
                        if (isDeletedEventNotification(updated)) {
                            setNotifications(prev => prev.filter(n => n.id !== updated.id));
                            return;
                        }
                        setNotifications(prev => prev.map(n => n.id === updated.id ? updated : n));
                    } else if (payload.eventType === 'DELETE') {
                        const deleted = payload.old as Notification;
                        setNotifications(prev => prev.filter(n => n.id !== deleted.id));
                    }
                }
            )
            .subscribe();

        return () => {
            cancelled = true;
            unsubscribeCalendar();
            supabase.removeChannel(channel);
        };
    }, [user, reconcileCalendarNotifications]);

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
