import { supabase } from '@/integrations/supabase/client';

export interface CalendarEvent {
    id: string;
    title: string;
    branch_name: string;
    sector: string;
    date: string; // ISO Date string (YYYY-MM-DD)
    created_at?: string;
}

export const calendarService = {
    // Fetch events. 
    // If isAdmin is true, returns all events.
    // If isAdmin is false and branchName provided, filters by branch_name.
    async getEvents(branchName?: string, isAdmin: boolean = false): Promise<CalendarEvent[]> {
        let query = supabase
            .from('inventory_events')
            .select('*')
            .order('date', { ascending: true });

        // Admin sees all. Branch sees only theirs.
        if (!isAdmin && branchName) {
            query = query.eq('branch_name', branchName);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching events:', error);
            return [];
        }

        return data || [];
    },

    async addEvent(event: Omit<CalendarEvent, 'id' | 'created_at'>): Promise<CalendarEvent | null> {
        // Use RPC 'manage_inventory_event' as per user instruction
        const { data, error } = await supabase
            .rpc('manage_inventory_event', {
                p_action: 'CREATE',
                p_title: event.title,
                p_branch: event.branch_name,
                p_sector: event.sector,
                p_date: event.date
            });

        if (error) {
            console.error('Error adding event via RPC:', error);
            return null;
        }

        // The RPC returns { id, title, branch_name, ... } directly
        return data as unknown as CalendarEvent;
    },

    async deleteEvent(id: string): Promise<boolean> {
        // Use RPC 'manage_inventory_event' as per user instruction
        const { error } = await supabase
            .rpc('manage_inventory_event', {
                p_action: 'DELETE',
                p_id: id
            });

        if (error) {
            console.error('Error deleting event via RPC:', error);
            return false;
        }

        return true;
    }
};
