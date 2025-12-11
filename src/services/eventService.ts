import { supabase } from "@/integrations/supabase/client";

export interface InventoryEvent {
    id: string;
    title: string;
    branch_name: string;
    sector: string;
    date: string;
    created_at?: string;
}

export const eventService = {
    // Get all events
    getEvents: async (): Promise<InventoryEvent[]> => {
        const { data, error } = await supabase
            .from('inventory_events')
            .select('*')
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching events:', error);
            return [];
        }

        return data || [];
    },

    // Get upcoming events (from today onwards)
    getUpcomingEvents: async (limit: number = 3): Promise<InventoryEvent[]> => {
        const today = new Date().toISOString().slice(0, 10);

        const { data, error } = await supabase
            .from('inventory_events')
            .select('*')
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(limit);

        if (error) {
            console.error('Error fetching upcoming events:', error);
            return [];
        }

        return data || [];
    },

    // Create event using RPC
    createEvent: async (event: Omit<InventoryEvent, 'id' | 'created_at'>): Promise<InventoryEvent | null> => {
        const { data, error } = await supabase.rpc('manage_inventory_event', {
            p_action: 'CREATE',
            p_title: event.title,
            p_branch: event.branch_name,
            p_sector: event.sector,
            p_date: event.date
        });

        if (error) {
            console.error('Error creating event:', error);
            return null;
        }

        // RPC returns the created object
        return data as unknown as InventoryEvent;
    },

    // Delete event using RPC
    deleteEvent: async (id: string): Promise<boolean> => {
        const { error } = await supabase.rpc('manage_inventory_event', {
            p_action: 'DELETE',
            p_id: id
        });

        if (error) {
            console.error('Error deleting event:', error);
            return false;
        }

        return true;
    }
};
