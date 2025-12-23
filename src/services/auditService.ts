
import { supabase } from "@/integrations/supabase/client";

export interface AuditLogEntry {
    action: string;
    entityType: string;
    entityId?: string;
    details?: any;
    branchId?: string;
    userId?: string;
}

export const auditService = {
    /**
     * Logs a critical action to the database.
     */
    async logAction(entry: AuditLogEntry) {
        try {
            // Get current user if not provided
            let userId = entry.userId;
            if (!userId) {
                const { data: { user } } = await supabase.auth.getUser();
                userId = user?.id;
            }

            if (!userId) {
                console.warn("Audit log attempted without user ID", entry);
                return;
            }

            const { error } = await supabase
                .from('audit_logs')
                .insert({
                    user_id: userId,
                    branch_id: entry.branchId,
                    action: entry.action,
                    entity_type: entry.entityType,
                    entity_id: entry.entityId,
                    details: entry.details
                });

            if (error) throw error;

        } catch (error) {
            // Fail silently in production but log in dev
            console.error("Failed to write audit log:", error);
        }
    },

    /**
     * Fetch logs (Admin only)
     */
    async getLogs(filters?: { userId?: string, action?: string, limit?: number }) {
        let query = supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(filters?.limit || 50);

        if (filters?.userId) {
            query = query.eq('user_id', filters.userId);
        }
        if (filters?.action) {
            query = query.eq('action', filters.action);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }
};
