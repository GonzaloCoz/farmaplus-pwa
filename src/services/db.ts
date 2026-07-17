import Dexie, { Table } from 'dexie';

// Interfaces match our Supabase schema but optimized for local usage
export interface PendingAction {
    id?: number;
    type: 'create' | 'update' | 'delete';
    entity: 'session' | 'item' | 'product' | 'device_file';
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
    profile?: 'sucursal' | 'sap';
}

export interface LocalLocationStatus {
    id?: string;
    session_id: string;
    location_tag: string;
    status: 'open' | 'closed';
    closed_at?: string;
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
    location_tag?: string;
}

export interface LocalProduct {
    ean: string;
    name: string;
    cost: number;
    salePrice?: number;
    laboratory?: string;
    stock?: number;
    id_producto?: string;
    session_id: string;
}

export class FarmaplusDB extends Dexie {
    sessions!: Table<LocalSession>;
    items!: Table<LocalItem>;
    locations!: Table<LocalLocationStatus>;
    precount_products!: Table<LocalProduct>;
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

        this.version(8).stores({
            sessions: 'id, status, start_time, synced, user_id, branch_id',
            items: 'id, session_id, ean, [session_id+ean], [session_id+ean+device_id], [session_id+location_tag], synced, id_producto, device_id, scanned_by, location_tag',
            locations: '++id, [session_id+location_tag], status',
            products: 'codebar, name',
            pendingActions: '++id, status, timestamp, entity'
        });

        this.version(9).stores({
            sessions: 'id, status, start_time, synced, user_id, branch_id',
            items: 'id, session_id, ean, [session_id+ean], [session_id+ean+device_id], [session_id+location_tag], synced, id_producto, device_id, scanned_by, location_tag',
            locations: '++id, [session_id+location_tag], status',
            products: null,
            precount_products: 'ean, name, session_id, [session_id+ean]',
            pendingActions: '++id, status, timestamp, entity'
        });
    }
}

export const db = new FarmaplusDB();
