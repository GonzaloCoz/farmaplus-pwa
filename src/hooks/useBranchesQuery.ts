import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BranchItem {
    id: string;
    name: string;
}

export const BRANCHES_QUERY_KEY = ['branches', 'list'];

export function useBranchesQuery() {
    return useQuery({
        queryKey: BRANCHES_QUERY_KEY,
        queryFn: async (): Promise<BranchItem[]> => {
            const { data, error } = await supabase
                .from('branches')
                .select('id, name')
                .order('name');

            if (error) {
                console.error("Error al obtener sucursales:", error);
                throw error;
            }

            return (data || []) as BranchItem[];
        },
        staleTime: 1000 * 60 * 10, // 10 minutos de frescura en caché
        gcTime: 1000 * 60 * 30,    // 30 minutos en memoria
    });
}
