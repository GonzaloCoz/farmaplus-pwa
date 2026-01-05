// Validation utilities for Cyclic Inventory

import { supabase } from '@/integrations/supabase/client';
import { CyclicItem } from './cyclicInventoryService';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface ValidationError {
    field: string;
    message: string;
    item?: CyclicItem;
}

/**
 * Validates inventory items before saving
 * Ensures data integrity and prevents common errors
 */
export async function validateInventory(
    items: CyclicItem[],
    branchName: string
): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Basic validations
    if (!items || items.length === 0) {
        errors.push('No hay items para guardar');
        return { valid: false, errors, warnings };
    }

    // 2. Validate EANs exist in products table
    const eans = items.map(i => i.ean).filter(Boolean);
    if (eans.length > 0) {
        try {
            const { data: existingProducts, error } = await supabase
                .from('products')
                .select('ean')
                .in('ean', eans);

            if (error) {
                console.error('Error validating EANs:', error);
                warnings.push('No se pudo validar todos los productos');
            } else {
                const existingEans = new Set(existingProducts?.map(p => p.ean) || []);
                const missingEans = eans.filter(ean => !existingEans.has(ean));

                if (missingEans.length > 0) {
                    errors.push(`${missingEans.length} producto(s) no encontrado(s) en la base de datos`);
                    if (missingEans.length <= 5) {
                        errors.push(`EANs faltantes: ${missingEans.join(', ')}`);
                    }
                }
            }
        } catch (e) {
            console.error('Error in EAN validation:', e);
            warnings.push('Error al validar productos');
        }
    }

    // 3. Validate quantities
    items.forEach((item, index) => {
        // Negative quantities
        if (item.countedQuantity < 0) {
            errors.push(`Cantidad negativa en "${item.name}" (${item.countedQuantity})`);
        }

        // Extremely large quantities (potential typo)
        if (item.countedQuantity > 10000) {
            warnings.push(`Cantidad muy alta en "${item.name}" (${item.countedQuantity})`);
        }

        // Missing required fields
        if (!item.ean) {
            errors.push(`Item ${index + 1} sin código EAN`);
        }
        if (!item.name) {
            warnings.push(`Item ${index + 1} sin nombre`);
        }
    });

    // 4. Validate extreme differences (>90% variance)
    items.forEach(item => {
        if (item.systemQuantity > 0) {
            const diff = Math.abs(item.countedQuantity - item.systemQuantity);
            const percentDiff = (diff / item.systemQuantity) * 100;

            if (percentDiff > 90 && item.status === 'controlled') {
                warnings.push(
                    `Diferencia >90% en "${item.name}": ` +
                    `Sistema: ${item.systemQuantity}, Contado: ${item.countedQuantity}`
                );
            }
        }
    });

    // 5. Check for duplicate EANs in the same batch
    const eanCounts = new Map<string, number>();
    items.forEach(item => {
        const count = eanCounts.get(item.ean) || 0;
        eanCounts.set(item.ean, count + 1);
    });

    const duplicates = Array.from(eanCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([ean]) => ean);

    if (duplicates.length > 0) {
        errors.push(`EANs duplicados: ${duplicates.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validates a single item change
 * Used for real-time validation during editing
 */
export function validateItem(item: CyclicItem): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!item.ean) {
        errors.push({
            field: 'ean',
            message: 'EAN requerido',
            item
        });
    }

    if (item.countedQuantity < 0) {
        errors.push({
            field: 'countedQuantity',
            message: 'La cantidad no puede ser negativa',
            item
        });
    }

    if (item.countedQuantity > 10000) {
        errors.push({
            field: 'countedQuantity',
            message: 'Cantidad sospechosamente alta',
            item
        });
    }

    return errors;
}

/**
 * Calculates data quality metrics
 */
export function calculateDataQuality(items: CyclicItem[]): {
    completeness: number;
    accuracy: number;
    totalItems: number;
    controlledItems: number;
    itemsWithLargeDiff: number;
} {
    const totalItems = items.length;
    const controlledItems = items.filter(i =>
        i.status === 'controlled' || i.status === 'adjusted'
    ).length;

    const itemsWithLargeDiff = items.filter(item => {
        if (item.systemQuantity === 0) return false;
        const diff = Math.abs(item.countedQuantity - item.systemQuantity);
        const percentDiff = (diff / item.systemQuantity) * 100;
        return percentDiff > 50;
    }).length;

    const completeness = totalItems > 0 ? (controlledItems / totalItems) * 100 : 0;
    const accuracy = totalItems > 0 ? ((totalItems - itemsWithLargeDiff) / totalItems) * 100 : 0;

    return {
        completeness: Math.round(completeness * 10) / 10,
        accuracy: Math.round(accuracy * 10) / 10,
        totalItems,
        controlledItems,
        itemsWithLargeDiff
    };
}
