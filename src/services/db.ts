import Dexie, { Table } from 'dexie';

// Interfaces match our Supabase schema but optimized for local usage
export interface PendingAction {
    id?: number;
    type: 'create' | 'update' | 'delete';
    entity: 'session' | 'item' | 'product';
    data: any; // The payload to send
    timestamp: number;
    status: 'pending' | 'syncing' | 'failed' | 'success';
    retries: number;
    error?: string;
}

export interface LocalSession {
    id: string; // UUID from Supabase or generated locally
    sector: string;
    start_time: string;
    end_time?: string;
    status: 'active' | 'completed';
    user_id?: string;
    synced: number; // 0 = false, 1 = true
}

export interface LocalItem {
    id: string; // UUID
    session_id: string;
    ean: string;
    product_name: string;
    quantity: number;
    scanned_at: string;
    scanned_by?: string;
    synced: number;
}

export interface LocalProduct {
    codebar: string;
    name: string;
    laboratory?: string;
    // We can cache more details here
}

export class FarmaplusDB extends Dexie {
    sessions!: Table<LocalSession>;
    items!: Table<LocalItem>;
    products!: Table<LocalProduct>;
    pendingActions!: Table<PendingAction>;

    constructor() {
        super('FarmaplusDB');

        this.version(1).stores({
            sessions: 'id, status, start_time, is_synced', // Indexes
            items: 'id, session_id, ean, is_synced',
            products: 'codebar, name',
            pendingActions: '++id, status, timestamp, entity' // ++id = auto-increment
        });

        this.version(2).stores({
            sessions: 'id, status, start_time, is_synced',
            items: 'id, session_id, ean, [session_id+ean], is_synced', // Added compound index
            products: 'codebar, name',
            pendingActions: '++id, status, timestamp, entity'
        });

        this.version(3).stores({
            sessions: 'id, status, start_time, synced',
            items: 'id, session_id, ean, [session_id+ean], synced',
            products: 'codebar, name',
            pendingActions: '++id, status, timestamp, entity'
        });
    }
}

export const db = new FarmaplusDB();
