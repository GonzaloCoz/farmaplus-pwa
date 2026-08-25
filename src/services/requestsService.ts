import { supabase } from "@/integrations/supabase/client";
import { normalizeString } from "@/lib/utils";

export type RequestType = 'Baja de Laboratorio' | 'Ajuste de Stock' | 'Modificación de Catálogo' | 'General';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface RequestItem {
    id: string;
    type: RequestType;
    branchName: string;
    targetName: string; // Nombre del laboratorio, producto u objetivo
    category?: string;
    round?: number;
    reason: string;
    comments?: string;
    requestedBy: string;
    requestedAt: string; // ISO date string
    status: RequestStatus;
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
}

const LOCAL_STORAGE_KEY = "farmaplus_solicitudes_v1";

// Solicitudes iniciales vacías
const INITIAL_DEMO_REQUESTS: RequestItem[] = [];

export const requestsService = {
    /**
     * Obtener todas las solicitudes (o filtradas por sucursal)
     */
    getRequests: async (branchName?: string): Promise<RequestItem[]> => {
        try {
            // 1. Intentar consultar desde Supabase
            const { data, error } = await (supabase as any)
                .from('requests')
                .select('*')
                .order('requested_at', { ascending: false });

            if (!error && data) {
                let formatted: RequestItem[] = data.map((d: any) => ({
                    id: d.id,
                    type: d.type || 'Baja de Laboratorio',
                    branchName: d.branch_name,
                    targetName: d.target_name,
                    category: d.category,
                    round: d.round,
                    reason: d.reason,
                    comments: d.comments,
                    requestedBy: d.requested_by,
                    requestedAt: d.requested_at,
                    status: d.status,
                    reviewedBy: d.reviewed_by,
                    reviewedAt: d.reviewed_at,
                    rejectionReason: d.rejection_reason
                }));

                // Guardar copia local de respaldo cuando no se filtra
                if (!branchName && formatted.length > 0) {
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formatted));
                }

                if (branchName) {
                    const norm = normalizeString(branchName);
                    formatted = formatted.filter(r => normalizeString(r.branchName) === norm);
                }

                return formatted;
            }
        } catch (e) {
            console.warn("Tabla 'requests' en Supabase no disponible aún, usando almacenamiento local:", e);
        }

        // 2. Fallback local storage
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        let items: RequestItem[] = local ? JSON.parse(local) : INITIAL_DEMO_REQUESTS;
        
        if (branchName) {
            const norm = normalizeString(branchName);
            items = items.filter(r => normalizeString(r.branchName) === norm);
        }

        return items;
    },

    /**
     * Crear una nueva solicitud
     */
    createRequest: async (req: Omit<RequestItem, 'id' | 'requestedAt' | 'status'>): Promise<RequestItem> => {
        const newItem: RequestItem = {
            ...req,
            id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            requestedAt: new Date().toISOString(),
            status: 'pending'
        };

        // Guardar local
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        const list: RequestItem[] = local ? JSON.parse(local) : INITIAL_DEMO_REQUESTS;
        list.unshift(newItem);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

        // Intentar guardar en Supabase en segundo plano
        try {
            await (supabase as any).from('requests').insert([{
                id: newItem.id,
                type: newItem.type,
                branch_name: newItem.branchName,
                target_name: newItem.targetName,
                category: newItem.category,
                round: newItem.round,
                reason: newItem.reason,
                comments: newItem.comments,
                requested_by: newItem.requestedBy,
                requested_at: newItem.requestedAt,
                status: newItem.status
            }]);
        } catch (e) {
            console.warn("No se pudo insertar en Supabase (modo local activo):", e);
        }

        return newItem;
    },

    /**
     * Aprobar una solicitud
     */
    approveRequest: async (requestId: string, reviewedBy: string): Promise<boolean> => {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        const list: RequestItem[] = local ? JSON.parse(local) : INITIAL_DEMO_REQUESTS;
        const target = list.find(r => r.id === requestId);

        if (!target) return false;

        target.status = 'approved';
        target.reviewedBy = reviewedBy;
        target.reviewedAt = new Date().toISOString();
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

        // Actualizar en Supabase
        try {
            await (supabase as any).from('requests').update({
                status: 'approved',
                reviewed_by: reviewedBy,
                reviewed_at: target.reviewedAt
            }).eq('id', requestId);
        } catch (e) {
            console.warn("Error al actualizar estado en Supabase:", e);
        }

        return true;
    },

    /**
     * Obtener laboratorios con baja aprobada para una sucursal
     */
    getApprovedBajas: async (branchName?: string): Promise<{ targetName: string; category?: string }[]> => {
        const all = await requestsService.getRequests(branchName);
        return all
            .filter(r => r.type === 'Baja de Laboratorio' && r.status === 'approved')
            .map(r => ({
                targetName: r.targetName.trim().toUpperCase(),
                category: r.category ? r.category.trim().toUpperCase() : undefined
            }));
    },

    /**
     * Rechazar una solicitud
     */
    rejectRequest: async (requestId: string, reviewedBy: string, rejectionReason?: string): Promise<boolean> => {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        const list: RequestItem[] = local ? JSON.parse(local) : INITIAL_DEMO_REQUESTS;
        const target = list.find(r => r.id === requestId);

        if (!target) return false;

        target.status = 'rejected';
        target.reviewedBy = reviewedBy;
        target.reviewedAt = new Date().toISOString();
        target.rejectionReason = rejectionReason;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

        try {
            await (supabase as any).from('requests').update({
                status: 'rejected',
                reviewed_by: reviewedBy,
                reviewed_at: target.reviewedAt,
                rejection_reason: rejectionReason
            }).eq('id', requestId);
        } catch (e) {
            console.warn("Error al actualizar estado en Supabase:", e);
        }

        return true;
    },

    /**
     * Actualizar estado de una solicitud
     */
    updateRequestStatus: async (requestId: string, newStatus: RequestStatus, reviewedBy?: string): Promise<boolean> => {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        const list: RequestItem[] = local ? JSON.parse(local) : INITIAL_DEMO_REQUESTS;
        const target = list.find(r => r.id === requestId);

        if (!target) return false;

        target.status = newStatus;
        if (reviewedBy) {
            target.reviewedBy = reviewedBy;
            target.reviewedAt = new Date().toISOString();
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

        try {
            await (supabase as any).from('requests').update({
                status: newStatus,
                reviewed_by: reviewedBy,
                reviewed_at: target.reviewedAt
            }).eq('id', requestId);
        } catch (e) {
            console.warn("Error al actualizar estado en Supabase:", e);
        }

        return true;
    },

    /**
     * Actualizar detalles/motivo de una solicitud (por la sucursal)
     */
    updateRequestDetails: async (requestId: string, reason: string, comments?: string): Promise<boolean> => {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        const list: RequestItem[] = local ? JSON.parse(local) : INITIAL_DEMO_REQUESTS;
        const target = list.find(r => r.id === requestId);

        if (!target) return false;

        target.reason = reason;
        if (comments !== undefined) target.comments = comments;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

        try {
            await (supabase as any).from('requests').update({
                reason: reason,
                comments: comments
            }).eq('id', requestId);
        } catch (e) {
            console.warn("Error al actualizar motivo en Supabase:", e);
        }

        return true;
    },

    /**
     * Eliminar un registro de solicitud
     */
    deleteRequest: async (requestId: string): Promise<boolean> => {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        let list: RequestItem[] = local ? JSON.parse(local) : INITIAL_DEMO_REQUESTS;
        list = list.filter(r => r.id !== requestId);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));

        try {
            await (supabase as any).from('requests').delete().eq('id', requestId);
        } catch (e) {
            console.warn("Error al eliminar en Supabase:", e);
        }

        return true;
    },

    /**
     * Verificar si un laboratorio ya tiene solicitud pendiente
     */
    hasPendingLabRequest: (branchName: string, labName: string, category?: string): boolean => {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        const list: RequestItem[] = local ? JSON.parse(local) : INITIAL_DEMO_REQUESTS;
        const branchNorm = normalizeString(branchName);
        const labNorm = normalizeString(labName);

        return list.some(r => 
            r.type === 'Baja de Laboratorio' &&
            r.status === 'pending' &&
            normalizeString(r.branchName) === branchNorm &&
            normalizeString(r.targetName) === labNorm &&
            (!category || !r.category || normalizeString(r.category) === normalizeString(category))
        );
    }
};
