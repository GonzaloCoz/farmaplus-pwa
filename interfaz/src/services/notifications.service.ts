
import { supabase } from "@/integrations/supabase/client";

export interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    category: string;
    title: string;
    message: string;
    is_read: boolean;
    metadata?: any;
    created_at: string;
}

export const notificationService = {
    /**
     * Send a notification to a specific user
     */
    async send(userId: string, notification: Omit<Notification, 'id' | 'created_at' | 'is_read'>) {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                ...notification
            });

        if (error) {
            console.error("Error sending notification:", error);
            throw error;
        }
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(id: string) {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Mark all notifications as read for current user
     */
    async markAllAsRead() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id);

        if (error) throw error;
    },

    /**
     * Delete a notification by ID
     */
    async deleteNotification(id: string) {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Send a notification to all users in a branch
     */
    async sendToBranch(branchName: string, notification: { title: string, message: string, type?: string, category?: string }, senderId?: string) {
        const { error } = await (supabase.rpc as any)('send_branch_notification', {
            p_branch_name: branchName,
            p_title: notification.title,
            p_message: notification.message,
            p_type: notification.type || 'info',
            p_category: notification.category || 'ANUNCIO'
        });

        if (error) {
            console.error("Error sending branch notification:", error);
            throw error;
        }

        // Log to admin's own notification history
        if (senderId) {
            await supabase.from('notifications').insert({
                user_id: senderId,
                title: `📤 Anuncio enviado a ${branchName}`,
                message: notification.message,
                type: 'info',
                category: 'ENVIADO',
                is_read: true
            });
        }
    }
};
