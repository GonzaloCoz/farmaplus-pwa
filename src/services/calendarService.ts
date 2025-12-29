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
    },

    async updateEvent(event: CalendarEvent): Promise<boolean> {
        // We try to use RPC 'manage_inventory_event' with UPDATE action if supported, 
        // or fallback to direct update if the RPC logic is unknown/complex.
        // Assuming user prefers RPC if exists. Let's try RPC first pattern 'UPDATE'.

        const { error } = await supabase
            .rpc('manage_inventory_event', {
                p_action: 'UPDATE',
                p_id: event.id,
                p_title: event.title,
                p_branch: event.branch_name,
                p_sector: event.sector,
                p_date: event.date
            });

        if (error) {
            console.error('Error updating event via RPC:', error);
            // Fallback: try direct Table Update if RPC fails or doesn't support UPDATE
            // This is safer given we don't see the RPC code.
            const { error: tableError } = await supabase
                .from('inventory_events')
                .update({
                    title: event.title,
                    branch_name: event.branch_name,
                    sector: event.sector,
                    date: event.date
                })
                .eq('id', event.id);

            if (tableError) {
                console.error('Error updating event via Table:', tableError);
                return false;
            }
            return true;
        }

        return true;
    }
};
