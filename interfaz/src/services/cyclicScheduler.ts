import { runForensicAudit } from './cyclicEngine';
import { normalizeString } from '@/lib/utils';

let schedulerIntervalId: NodeJS.Timeout | null = null;

/**
 * Inicializa el planificador silencioso del Micro-Engine Forense.
 * - Corre en segundo plano de forma desatendida.
 * - Comprueba cada 15 minutos si ya se ejecutó el peritaje hoy.
 * - Si son >= 07:30 AM (o si se abrió más tarde) y aún no corrió hoy,
 *   ejecuta la auditoría en <500ms y actualiza cyclic_labs sin bloquear la UI ni mostrar alertas.
 */
export function startCyclicScheduler(branchNameOrId: string | number): void {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
    }

    const checkAndRun = async () => {
        try {
            const branchSlug = typeof branchNameOrId === 'number'
                ? String(branchNameOrId)
                : normalizeString(branchNameOrId);

            const today = new Date().toISOString().split('T')[0];
            const lastAudit = localStorage.getItem(`cyclic_last_audit_${branchSlug}`);

            if (lastAudit === today) {
                return; // Ya se peritó hoy
            }

            const now = new Date();
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();

            // Ejecuta si ya son las 07:30 AM o posterior
            const isTimeOrLater = currentHour > 7 || (currentHour === 7 && currentMin >= 30);

            if (isTimeOrLater) {
                console.log(`[CyclicScheduler] Ejecutando peritaje forense silencioso para ${branchSlug}...`);
                const summary = await runForensicAudit(branchNameOrId);
                console.log(
                    `[CyclicScheduler] Peritaje finalizado en ${summary.elapsedMs}ms: ` +
                    `${summary.activeCount} activos, ${summary.stockoutCount} quiebres, ${summary.hibernatedCount} hibernados.`
                );
            }
        } catch (err) {
            console.error('[CyclicScheduler] Error en ejecución silenciosa:', err);
        }
    };

    // 1. Ejecutar verificación inmediata al arrancar (catch-up)
    checkAndRun();

    // 2. Comprobar cada 15 minutos
    schedulerIntervalId = setInterval(checkAndRun, 15 * 60 * 1000);
}

export function stopCyclicScheduler(): void {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
        schedulerIntervalId = null;
    }
}
