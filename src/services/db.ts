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
    branch_id?: string;
    synced: number; // 0 = false, 1 = true
    sync_pin?: string;
    master_catalog?: any[]; // Used for device validation & recon
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
    id_producto?: string;
    device_id?: string;
    device_name?: string;
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

        this.version(4).stores({
            sessions: 'id, status, start_time, synced',
            items: 'id, session_id, ean, [session_id+ean], synced, id_producto',
            products: 'codebar, name',
            pendingActions: '++id, status, timestamp, entity'
        });

        this.version(6).stores({
            sessions: 'id, status, start_time, synced, user_id, branch_id',
            items: 'id, session_id, ean, [session_id+ean], [session_id+ean+device_id], synced, id_producto, device_id, scanned_by',
            products: 'codebar, name',
            pendingActions: '++id, status, timestamp, entity'
        });
    }
}

export const db = new FarmaplusDB();
