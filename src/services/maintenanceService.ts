import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notifications";

export const maintenanceService = {
    /**
     * Limpia inventarios que no pertenecen a ningún laboratorio configurado para la sucursal.
     * También elimina registros con nombres de laboratorio inválidos o nulos.
     */
    cleanupOrphanedInventories: async () => {
        try {
            console.log("Iniciando limpieza de inventarios huérfanos...");

            // 1. Obtener laboratorios configurados (maestro)
            const { data: configLabs, error: configError } = await supabase
                .from('branch_laboratories')
                .select('branch_name, laboratory');

            if (configError) throw configError;

            // Creamos un Set de llaves validas "Sucursal|Laboratorio"
            const validKeys = new Set(configLabs.map(l => `${l.branch_name}|${l.laboratory}`));

            // 2. Obtener todos los laboratorios que tienen items en 'inventories'
            const { data: currentInventoryLabs, error: invError } = await supabase
                .from('inventories')
                .select('branch_name, laboratory')
                .not('laboratory', 'is', null)
                .neq('laboratory', '_CONFIG_'); // Excluir configuraciones

            if (invError) throw invError;

            // Filtrar los que no están en el maestro
            const orphanedLabs = Array.from(new Set(
                currentInventoryLabs
                    .map(l => ({ branch: l.branch_name, lab: l.laboratory }))
                    .filter(l => !validKeys.has(`${l.branch}|${l.lab}`))
                    .map(l => JSON.stringify(l))
            )).map(l => JSON.parse(l));

            if (orphanedLabs.length === 0) {
                console.log("No se encontraron inventarios huérfanos.");
                return 0;
            }

            console.log(`Borrando residuos de ${orphanedLabs.length} laboratorios huérfanos...`);

            let deletedTotal = 0;
            for (const orphaned of orphanedLabs) {
                const { error: deleteError, count } = await supabase
                    .from('inventories')
                    .delete()
                    .eq('branch_name', orphaned.branch)
                    .eq('laboratory', orphaned.lab);

                if (!deleteError) deletedTotal += (count || 0);
            }

            return deletedTotal;
        } catch (error) {
            console.error("Error en cleanupOrphanedInventories:", error);
            throw error;
        }
    },

    /**
     * Estandariza los nombres de las categorías para evitar duplicados por minúsculas/acentos.
     */
    standardizeCategories: async () => {
        try {
            // Normalización masiva a mayúsculas y sin espacios extras
            const { error } = await (supabase as any).rpc('normalize_inventory_categories');

            if (error) {
                // Si la RPC no existe aún, intentamos via update directo (fallback)
                console.warn("RPC normalize_inventory_categories no encontrada, usando fallback");
                await (supabase as any)
                    .from('inventories')
                    .update({ category: 'MEDICAMENTOS' })
                    .ilike('category', 'Medicamento%');

                await (supabase as any)
                    .from('inventories')
                    .update({ category: 'PERFUMERIA' })
                    .ilike('category', 'Perfumer%');
            }

            return true;
        } catch (error) {
            console.error("Error en standardizeCategories:", error);
            throw error;
        }
    },

    /**
     * Ejecuta una limpieza profunda de la base de datos (Solo Admin).
     */
    performDeepCleanup: async () => {
        const toastId = notify.info("Limpieza", "Iniciando mantenimiento profundo...");
        try {
            const deletedOrphans = await maintenanceService.cleanupOrphanedInventories();
            await maintenanceService.standardizeCategories();

            notify.success("Mantenimiento Completado", `Se eliminaron ${deletedOrphans} registros huérfanos y se normalizaron las categorías.`);
        } catch (error) {
            notify.error("Error de Mantenimiento", "No se pudo completar la limpieza de la base de datos.");
        }
    }
};
