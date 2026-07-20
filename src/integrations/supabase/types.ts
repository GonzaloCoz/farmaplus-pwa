export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            app_versions: {
                Row: {
                    id: string
                    version: string
                    release_notes: string | null
                    is_active: boolean
                    published_by: string | null
                    published_at: string
                }
                Insert: {
                    id?: string
                    version: string
                    release_notes?: string | null
                    is_active?: boolean
                    published_by?: string | null
                    published_at?: string
                }
                Update: {
                    id?: string
                    version?: string
                    release_notes?: string | null
                    is_active?: boolean
                    published_by?: string | null
                    published_at?: string
                }
                Relationships: []
            }
            audit_logs: {
                Row: {
                    id: string
                    created_at: string
                    user_id: string | null
                    branch_id: string | null
                    action: string
                    entity_type: string
                    entity_id: string | null
                    details: Json
                }
                Insert: {
                    id?: string
                    created_at?: string
                    user_id?: string | null
                    branch_id?: string | null
                    action: string
                    entity_type: string
                    entity_id?: string | null
                    details?: Json
                }
                Update: {
                    id?: string
                    created_at?: string
                    user_id?: string | null
                    branch_id?: string | null
                    action?: string
                    entity_type?: string
                    entity_id?: string | null
                    details?: Json
                }
                Relationships: []
            }
            notifications: {
                Row: {
                    id: string
                    created_at: string
                    user_id: string
                    type: string
                    category: string
                    title: string
                    message: string
                    is_read: boolean
                    metadata: Json
                }
                Insert: {
                    id?: string
                    created_at?: string
                    user_id: string
                    type: string
                    category: string
                    title: string
                    message: string
                    is_read?: boolean
                    metadata?: Json
                }
                Update: {
                    id?: string
                    created_at?: string
                    user_id?: string
                    type?: string
                    category?: string
                    title?: string
                    message?: string
                    is_read?: boolean
                    metadata?: Json
                }
                Relationships: []
            }
            branches: {
                Row: {
                    id: string
                    name: string
                    slug: string
                    address: string | null
                    created_at: string
                    config: Json
                }
                Insert: {
                    id?: string
                    name: string
                    slug: string
                    address?: string | null
                    created_at?: string
                    config?: Json
                }
                Update: {
                    id?: string
                    name?: string
                    slug?: string
                    address?: string | null
                    created_at?: string
                    config?: Json
                }
                Relationships: []
            }
            branch_laboratories: {
                Row: {
                    id: string
                    branch_name: string
                    laboratory: string
                    category: string
                    created_at: string
                    total_items: number
                    controlled_items: number
                    adjusted_items: number
                    pending_items: number
                    progress_percentage: number
                    total_system_units: number
                    net_units: number
                    net_value: number
                    negative_value: number
                    positive_value: number
                    status: string
                }
                Insert: {
                    id?: string
                    branch_name: string
                    laboratory: string
                    category: string
                    created_at?: string
                    total_items?: number
                    controlled_items?: number
                    adjusted_items?: number
                    pending_items?: number
                    progress_percentage?: number
                    total_system_units?: number
                    net_units?: number
                    net_value?: number
                    negative_value?: number
                    positive_value?: number
                    status?: string
                }
                Update: {
                    id?: string
                    branch_name?: string
                    laboratory?: string
                    category?: string
                    created_at?: string
                    total_items?: number
                    controlled_items?: number
                    adjusted_items?: number
                    pending_items?: number
                    progress_percentage?: number
                    total_system_units?: number
                    net_units?: number
                    net_value?: number
                    negative_value?: number
                    positive_value?: number
                    status?: string
                }
                Relationships: []
            }
            permissions: {
                Row: {
                    code: string
                    category: string
                    description: string
                }
                Insert: {
                    code: string
                    category?: string
                    description?: string
                }
                Update: {
                    code?: string
                    category?: string
                    description?: string
                }
                Relationships: []
            }
            role_permissions: {
                Row: {
                    role: string
                    permission_code: string
                }
                Insert: {
                    role: string
                    permission_code: string
                }
                Update: {
                    role?: string
                    permission_code?: string
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    id: string
                    username: string
                    full_name: string | null
                    role: string
                    branch_id: string | null
                    active: boolean
                    created_at: string
                    permissions: string[] | null
                }
                Insert: {
                    id?: string
                    username: string
                    full_name?: string | null
                    role: string
                    branch_id?: string | null
                    active?: boolean
                    created_at?: string
                    permissions?: string[] | null
                }
                Update: {
                    id?: string
                    username?: string
                    full_name?: string | null
                    role?: string
                    branch_id?: string | null
                    active?: boolean
                    created_at?: string
                    permissions?: string[] | null
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_branch_id_fkey"
                        columns: ["branch_id"]
                        referencedRelation: "branches"
                        referencedColumns: ["id"]
                    }
                ]
            }
            branch_goals: {
                Row: {
                    id: string
                    branch_name: string
                    sector: string
                    goal_percentage: number
                    total_labs_goal: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    branch_name: string
                    sector: string
                    goal_percentage: number
                    total_labs_goal?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    branch_name?: string
                    sector?: string
                    goal_percentage?: number
                    total_labs_goal?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            inventory_reports: {
                Row: {
                    id: string
                    branch_name: string
                    laboratory: string
                    report_date: string
                    snapshot: Json
                    snapshot_data: Json
                    financial_summary: Json
                    user_name: string | null
                    created_at: string
                    sector: string
                }
                Insert: {
                    id?: string
                    branch_name: string
                    laboratory: string
                    report_date?: string
                    snapshot: Json
                    snapshot_data?: Json
                    financial_summary?: Json
                    user_name?: string | null
                    created_at?: string
                    sector: string
                }
                Update: {
                    id?: string
                    branch_name?: string
                    laboratory?: string
                    report_date?: string
                    snapshot?: Json
                    snapshot_data?: Json
                    financial_summary?: Json
                    user_name?: string | null
                    created_at?: string
                    sector?: string
                }
                Relationships: []
            }
            inventories: {
                Row: {
                    id: string
                    branch_name: string
                    laboratory: string
                    category: string | null
                    ean: string
                    quantity: number
                    system_quantity: number
                    status: string
                    was_readjusted: boolean
                    adjustment_id_shortage: string | null
                    adjustment_id_surplus: string | null
                    round: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    branch_name: string
                    laboratory: string
                    category?: string | null
                    ean: string
                    quantity?: number
                    system_quantity?: number
                    status?: string
                    was_readjusted?: boolean
                    adjustment_id_shortage?: string | null
                    adjustment_id_surplus?: string | null
                    round?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    branch_name?: string
                    laboratory?: string
                    category?: string | null
                    ean?: string
                    quantity?: number
                    system_quantity?: number
                    status?: string
                    was_readjusted?: boolean
                    adjustment_id_shortage?: string | null
                    adjustment_id_surplus?: string | null
                    round?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: []
            }
            inventory_events: {
                Row: {
                    id: string
                    title: string
                    branch_name: string
                    sector: string
                    date: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    branch_name: string
                    sector: string
                    date: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    branch_name?: string
                    sector?: string
                    date?: string
                    created_at?: string
                }
                Relationships: []
            }
            inventory_adjustments: {
                Row: {
                    id: string
                    branch_name: string
                    laboratory: string
                    adjustment_id_shortage: string | null
                    adjustment_id_surplus: string | null
                    shortage_value: number
                    surplus_value: number
                    total_units_adjusted: number
                    user_name: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    branch_name: string
                    laboratory: string
                    adjustment_id_shortage?: string | null
                    adjustment_id_surplus?: string | null
                    shortage_value?: number
                    surplus_value?: number
                    total_units_adjusted?: number
                    user_name?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    branch_name?: string
                    laboratory?: string
                    adjustment_id_shortage?: string | null
                    adjustment_id_surplus?: string | null
                    shortage_value?: number
                    surplus_value?: number
                    total_units_adjusted?: number
                    user_name?: string | null
                    created_at?: string
                }
                Relationships: []
            }
            products: {
                Row: {
                    id: string
                    ean: string
                    name: string
                    laboratory: string | null
                    category: string | null
                    cost: number
                    sale_price: number
                    stock: number
                    created_at: string
                    updated_at: string
                    id_producto: string | null
                }
                Insert: {
                    id?: string
                    ean: string
                    name: string
                    laboratory?: string | null
                    category?: string | null
                    cost?: number
                    sale_price?: number
                    stock?: number
                    created_at?: string
                    updated_at?: string
                    id_producto?: string | null
                }
                Update: {
                    id?: string
                    ean?: string
                    name?: string
                    laboratory?: string | null
                    category?: string | null
                    cost?: number
                    sale_price?: number
                    stock?: number
                    created_at?: string
                    updated_at?: string
                    id_producto?: string | null
                }
                Relationships: []
            }
            expiration_sessions: {
                Row: {
                    id: string
                    sector: string
                    branch_name: string
                    start_time: number
                    end_time: number | null
                    status: string
                    total_products: number
                    total_units: number
                }
                Insert: {
                    id?: string
                    sector: string
                    branch_name: string
                    start_time: number
                    end_time?: number | null
                    status: string
                    total_products?: number
                    total_units?: number
                }
                Update: {
                    id?: string
                    sector?: string
                    branch_name?: string
                    start_time?: number
                    end_time?: number | null
                    status?: string
                    total_products?: number
                    total_units?: number
                }
                Relationships: []
            }
            precount_sessions: {
                Row: {
                    id: string
                    sector: string
                    start_time: string
                    end_time: string | null
                    status: string
                    user_id: string | null
                }
                Insert: {
                    id?: string
                    sector: string
                    start_time?: string
                    end_time?: string | null
                    status?: string
                    user_id?: string | null
                }
                Update: {
                    id?: string
                    sector?: string
                    start_time?: string
                    end_time?: string | null
                    status?: string
                    user_id?: string | null
                }
                Relationships: []
            }
            precount_items: {
                Row: {
                    id: string
                    session_id: string
                    ean: string
                    product_name: string
                    quantity: number
                    scanned_at: string
                    scanned_by: string | null
                }
                Insert: {
                    id?: string
                    session_id: string
                    ean: string
                    product_name: string
                    quantity?: number
                    scanned_at?: string
                    scanned_by?: string | null
                }
                Update: {
                    id?: string
                    session_id?: string
                    ean?: string
                    product_name?: string
                    quantity?: number
                    scanned_at?: string
                    scanned_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "precount_items_session_id_fkey"
                        columns: ["session_id"]
                        referencedRelation: "precount_sessions"
                        referencedColumns: ["id"]
                    }
                ]
            }
            expiration_items: {
                Row: {
                    id: string
                    session_id: string
                    ean: string
                    product_name: string
                    batches: Json
                    total_quantity: number
                    timestamp: number
                    synced: number
                    branch_name: string
                }
                Insert: {
                    id?: string
                    session_id: string
                    ean: string
                    product_name: string
                    batches: Json
                    total_quantity?: number
                    timestamp: number
                    synced?: number
                    branch_name: string
                }
                Update: {
                    id?: string
                    session_id?: string
                    ean?: string
                    product_name?: string
                    batches?: Json
                    total_quantity?: number
                    timestamp?: number
                    synced?: number
                    branch_name?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "expiration_items_session_id_fkey"
                        columns: ["session_id"]
                        referencedRelation: "expiration_sessions"
                        referencedColumns: ["id"]
                    }
                ]
            }
            inventory_ledger: {
                Row: {
                    id: string
                    branch_name: string
                    laboratory: string
                    category: string | null
                    user_id: string | null
                    user_name: string | null
                    adjustment_id_shortage: string | null
                    adjustment_id_surplus: string | null
                    total_shortage_value: number
                    total_surplus_value: number
                    total_net_value: number
                    total_items_adjusted: number
                    total_counted_items: number
                    round: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    branch_name: string
                    laboratory: string
                    category?: string | null
                    user_id?: string | null
                    user_name?: string | null
                    adjustment_id_shortage?: string | null
                    adjustment_id_surplus?: string | null
                    total_shortage_value?: number
                    total_surplus_value?: number
                    total_net_value?: number
                    total_items_adjusted?: number
                    total_counted_items?: number
                    round?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    branch_name?: string
                    laboratory?: string
                    category?: string | null
                    user_id?: string | null
                    user_name?: string | null
                    adjustment_id_shortage?: string | null
                    adjustment_id_surplus?: string | null
                    total_shortage_value?: number
                    total_surplus_value?: number
                    total_net_value?: number
                    total_items_adjusted?: number
                    total_counted_items?: number
                    round?: number
                    created_at?: string
                }
                Relationships: []
            }
            inventory_ledger_items: {
                Row: {
                    id: string
                    ledger_id: string
                    ean: string
                    product_name: string
                    category: string | null
                    system_quantity: number
                    counted_quantity: number
                    difference: number
                    unit_cost: number
                    total_diff_value: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    ledger_id: string
                    ean: string
                    product_name: string
                    category?: string | null
                    system_quantity: number
                    counted_quantity: number
                    difference: number
                    unit_cost: number
                    total_diff_value: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    ledger_id?: string
                    ean?: string
                    product_name?: string
                    category?: string | null
                    system_quantity?: number
                    counted_quantity?: number
                    difference?: number
                    unit_cost?: number
                    total_diff_value?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "inventory_ledger_items_ledger_id_fkey"
                        columns: ["ledger_id"]
                        referencedRelation: "inventory_ledger"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            manage_inventory_event: {
                Args: {
                    p_branch_name: string
                    p_event_data: Json
                    p_event_type: string
                    p_lab_name: string
                }
                Returns: undefined
            }
            save_cyclic_inventory: {
                Args: {
                    p_branch_name: string
                    p_items: Json
                    p_lab_name: string
                }
                Returns: undefined
            }
            upsert_precount_item: {
                Args: {
                    p_session_id: string
                    p_ean: string
                    p_product_name: string
                    p_quantity: number
                    p_user_id?: string
                }
                Returns: {
                    id: string
                    session_id: string
                    ean: string
                    product_name: string
                    quantity: number
                    scanned_at: string
                    scanned_by: string | null
                }[]
            }
            get_session_summary: {
                Args: {
                    p_session_id: string
                }
                Returns: {
                    total_products: number
                    total_units: number
                    last_updated: string | null
                }[]
            }
            search_products_optimized: {
                Args: {
                    p_query: string
                    p_limit?: number
                }
                Returns: {
                    ean: string
                    name: string
                    cost: number
                    sale_price: number
                    category: string | null
                    laboratory: string | null
                    id_producto: string | null
                }[]
            }
            get_product_by_ean: {
                Args: {
                    p_ean: string
                }
                Returns: {
                    ean: string
                    name: string
                    cost: number
                    sale_price: number
                    category: string | null
                    laboratory: string | null
                    id_producto: string | null
                }[]
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
