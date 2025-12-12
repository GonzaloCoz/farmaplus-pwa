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
                }
                Insert: {
                    id?: string
                    branch_name: string
                    laboratory: string
                    category: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    branch_name?: string
                    laboratory?: string
                    category?: string
                    created_at?: string
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
                }
                Insert: {
                    id?: string
                    username: string
                    full_name?: string | null
                    role: string
                    branch_id?: string | null
                    active?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    username?: string
                    full_name?: string | null
                    role?: string
                    branch_id?: string | null
                    active?: boolean
                    created_at?: string
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
                    ean: string
                    quantity: number
                    system_quantity: number
                    status: string
                    was_readjusted: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    branch_name: string
                    laboratory: string
                    ean: string
                    quantity?: number
                    system_quantity?: number
                    status?: string
                    was_readjusted?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    branch_name?: string
                    laboratory?: string
                    ean?: string
                    quantity?: number
                    system_quantity?: number
                    status?: string
                    was_readjusted?: boolean
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
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            manage_inventory_event: {
                Args: {
                    p_action: string
                    p_title?: string
                    p_branch?: string
                    p_sector?: string
                    p_date?: string
                    p_id?: string
                }
                Returns: Json
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
