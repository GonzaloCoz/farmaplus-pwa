import { z } from 'zod';

export const LaboratoryStatusSchema = z.enum(["controlado", "por_controlar", "pendiente"]);

export const CyclicItemSchema = z.object({
    id: z.string(),
    ean: z.string(),
    name: z.string().default('Desconocido'),
    systemQuantity: z.number().default(0),
    countedQuantity: z.number().nullable().default(0),
    cost: z.number().default(0),
    status: z.enum(['pending', 'controlled', 'adjusted']),
    category: z.string().optional().nullable(),
    wasReadjusted: z.boolean().optional().nullable().default(false),
    updatedAt: z.string().optional().nullable(),
    shortageId: z.string().optional().nullable(),
    surplusId: z.string().optional().nullable(),
});

export const CyclicInventoryStatsSchema = z.object({
    labName: z.string(),
    category: z.string(),
    status: LaboratoryStatusSchema,
    totalItems: z.number().default(0),
    controlledItems: z.number().default(0),
    progress: z.number().default(0),
    negativeValue: z.number().default(0),
    positiveValue: z.number().default(0),
    netValue: z.number().default(0),
    differenceValue: z.number().default(0),
    totalSystemUnits: z.number().default(0),
    negativeUnits: z.number().default(0),
    positiveUnits: z.number().default(0),
    netUnits: z.number().default(0),
});

export const BranchSummaryLiteSchema = z.object({
    branchName: z.string(),
    inventoryUnits: z.number().default(0),
    differenceUnits: z.number().default(0),
    adjustmentsValue: z.number().default(0),
    controlledLabsCount: z.number().default(0),
    activeLabsCount: z.number().default(0),
    totalControlledItems: z.number().default(0),
    totalItemsSum: z.number().default(0),
    weightedProgressSum: z.number().default(0),
    assignedDays: z.number().default(0),
    remainingDays: z.number().default(0),
    updatedAt: z.string().optional().nullable(),
});

export type CyclicItemValidated = z.infer<typeof CyclicItemSchema>;
export type CyclicInventoryStatsValidated = z.infer<typeof CyclicInventoryStatsSchema>;
export type BranchSummaryLiteValidated = z.infer<typeof BranchSummaryLiteSchema>;
