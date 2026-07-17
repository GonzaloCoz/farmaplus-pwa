import { supabase } from "@/integrations/supabase/client";
import { getAllExpirationItems } from "@/services/expirationDB";

export interface ProactiveAlert {
  type: 'discrepancy' | 'expiration' | 'stalled';
  severity: 'warning' | 'critical';
  summary: string;
  suggestedQuery: string;
  details: {
    laboratory?: string;
    productName?: string;
    ean?: string;
    daysUntilExpiry?: number;
    differenceValue?: number;
    differenceUnits?: number;
    stalledDays?: number;
  };
}

export const proactiveAlertService = {
  async checkAlerts(branchName: string): Promise<ProactiveAlert | null> {
    if (!branchName) return null;

    try {
      const alerts: ProactiveAlert[] = [];

      // 1. Check for significant discrepancies in branch_laboratories
      const { data: labs, error: labsError } = await (supabase as any).rpc(
        'get_all_cyclic_inventories',
        { p_branch_name: branchName }
      );

      if (labsError) {
        console.error("Error fetching branch laboratories for proactive alerts:", labsError);
      } else if (labs) {
        for (const lab of labs) {
          const netValue = lab.net_value || 0;
          const netUnits = lab.net_units || 0;
          
          // Discrepancy threshold: net_value <= -10000 (negative adjustment worth more than 10k) or net_units absolute >= 20
          if (netValue <= -10000 || Math.abs(netUnits) >= 20) {
            const isCritical = netValue <= -15000 || Math.abs(netUnits) >= 40;
            alerts.push({
              type: 'discrepancy',
              severity: isCritical ? 'critical' : 'warning',
              summary: `El laboratorio **${lab.laboratory}** tiene diferencias de stock significativas: un saldo neto de $${Math.round(netValue).toLocaleString('es-AR')} (${netUnits} unidades).`,
              suggestedQuery: `Hola, veo que hay diferencias importantes en el laboratorio ${lab.laboratory} ($${Math.round(netValue).toLocaleString('es-AR')}, ${netUnits} unidades). ¿Me podés dar un análisis detallado y sugerir cómo proceder para auditarlo?`,
              details: {
                laboratory: lab.laboratory,
                differenceValue: netValue,
                differenceUnits: netUnits
              }
            });
          }

          // 2. Check for stalled laboratories (in_progress for more than 48 hours)
          if (lab.status === 'in_progress') {
            const createdDate = new Date(lab.created_at);
            const msDiff = Date.now() - createdDate.getTime();
            const daysDiff = msDiff / (1000 * 60 * 60 * 24);

            if (daysDiff >= 2) {
              const isCritical = daysDiff >= 3 && (lab.progress_percentage || 0) < 80;
              alerts.push({
                type: 'stalled',
                severity: isCritical ? 'critical' : 'warning',
                summary: `El laboratorio **${lab.laboratory}** está en progreso desde hace ${Math.floor(daysDiff)} días con un avance del ${Math.round(lab.progress_percentage || 0)}%.`,
                suggestedQuery: `Hola, el laboratorio ${lab.laboratory} lleva ${Math.floor(daysDiff)} días sin terminarse (avance ${Math.round(lab.progress_percentage || 0)}%). ¿Qué pendientes quedan y cómo puedo agilizar el cierre?`,
                details: {
                  laboratory: lab.laboratory,
                  stalledDays: Math.floor(daysDiff)
                }
              });
            }
          }
        }
      }

      // 3. Check for expiring products (expiration_items)
      try {
        const expirationItems = await getAllExpirationItems(branchName);
        const today = new Date();
        
        for (const item of expirationItems) {
          if (!item.batches) continue;
          
          for (const batch of item.batches) {
            // Only active batches (not sold/transferred/etc.)
            if (batch.status && batch.status !== 'active') continue;

            // Parse date (DD/MM/YYYY or MM/YYYY)
            let expiryDate: Date;
            const parts = batch.expirationDate.split('/');
            if (parts.length === 0) continue;

            let year = parseInt(parts[parts.length - 1]);
            if (isNaN(year)) continue;
            if (year < 100) year += 2000;

            if (parts.length === 2) { // MM/YYYY
              expiryDate = new Date(year, parseInt(parts[0]), 0); // Last day of month
            } else if (parts.length === 3) { // DD/MM/YYYY
              expiryDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
              continue;
            }

            const msDiff = expiryDate.getTime() - today.getTime();
            const daysUntilExpiry = Math.ceil(msDiff / (1000 * 60 * 60 * 24));

            // Expiration threshold: within 90 days (3 months)
            if (daysUntilExpiry <= 90) {
              const isCritical = daysUntilExpiry <= 30; // 1 month
              alerts.push({
                type: 'expiration',
                severity: isCritical ? 'critical' : 'warning',
                summary: `El producto **${item.productName}** (Lote: ${batch.batchNumber}) vence el ${batch.expirationDate} (${daysUntilExpiry} días restantes, stock: ${batch.quantity} un.).`,
                suggestedQuery: `Hola, detecté que el producto ${item.productName} (EAN: ${item.ean}, Lote: ${batch.batchNumber}) vence pronto (${batch.expirationDate}, ${daysUntilExpiry} días restantes). ¿Qué opciones tenemos? ¿Me sugerís transferirlo o armar una promoción?`,
                details: {
                  productName: item.productName,
                  ean: item.ean,
                  daysUntilExpiry: daysUntilExpiry
                }
              });
            }
          }
        }
      } catch (expError) {
        console.error("Error checking expiration items for proactive alerts:", expError);
      }

      if (alerts.length === 0) return null;

      // Prioritize: Critical alerts first, then Warning. Within same severity, prioritize discrepancy -> expiration -> stalled
      alerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;

        const typePriority = { discrepancy: 1, expiration: 2, stalled: 3 };
        return typePriority[a.type] - typePriority[b.type];
      });

      return alerts[0];
    } catch (error) {
      console.error("Unexpected error checking proactive alerts:", error);
      return null;
    }
  }
};
