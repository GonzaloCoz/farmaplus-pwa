// Smart Auto-Save for Cyclic Inventory
// Implements debouncing and intelligent save strategies

import { CyclicItem, cyclicInventoryService } from './cyclicInventoryService';
import { validateInventory } from './inventoryValidation';
import { notify } from '@/lib/notifications';

export class SmartAutoSave {
    private queue: CyclicItem[] = [];
    private saveTimer: NodeJS.Timeout | null = null;
    private isSaving = false;
    private lastSaveTime = 0;
    private branchName: string;
    private labName: string;

    // Configuration
    private readonly DEBOUNCE_MS = 2000; // Wait 2s after last change
    private readonly MIN_SAVE_INTERVAL_MS = 5000; // Don't save more than once per 5s
    private readonly MAX_RETRIES = 3;

    constructor(branchName: string, labName: string) {
        this.branchName = branchName;
        this.labName = labName;
    }

    /**
     * Schedule an auto-save with debouncing
     * Waits for user to stop making changes before saving
     */
    scheduleAutoSave(items: CyclicItem[], immediate = false) {
        this.queue = items;

        // Clear existing timer
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        // Immediate save (e.g., on blur or explicit save button)
        if (immediate) {
            this.executeSave();
            return;
        }

        // Debounced save
        this.saveTimer = setTimeout(() => {
            this.executeSave();
        }, this.DEBOUNCE_MS);
    }

    /**
     * Execute the save operation with validation and error handling
     */
    private async executeSave(retryCount = 0) {
        // Prevent concurrent saves
        if (this.isSaving) {
            console.log('Save already in progress, skipping...');
            return;
        }

        // Rate limiting
        const timeSinceLastSave = Date.now() - this.lastSaveTime;
        if (timeSinceLastSave < this.MIN_SAVE_INTERVAL_MS) {
            console.log('Saving too frequently, waiting...');
            setTimeout(() => this.executeSave(retryCount), this.MIN_SAVE_INTERVAL_MS - timeSinceLastSave);
            return;
        }

        this.isSaving = true;

        try {
            // Show saving indicator
            const savingToast = notify.info('💾 Guardando...', {
                duration: 0, // Don't auto-dismiss
                id: 'auto-save-progress'
            });

            // Validate before saving
            const validation = await validateInventory(this.queue, this.branchName);

            if (!validation.valid) {
                notify.dismiss('auto-save-progress');
                notify.error('Error de validación', validation.errors[0], {
                    duration: 5000
                });
                return;
            }

            // Show warnings if any
            if (validation.warnings.length > 0) {
                console.warn('Validation warnings:', validation.warnings);
                // Don't block save, just log warnings
            }

            // Perform save
            await cyclicInventoryService.saveInventory(
                this.branchName,
                this.labName,
                this.queue
            );

            // Success
            this.lastSaveTime = Date.now();
            notify.dismiss('auto-save-progress');
            notify.success('✓ Guardado', {
                duration: 1500,
                id: 'auto-save-success'
            });

        } catch (error: any) {
            notify.dismiss('auto-save-progress');

            // Retry logic
            if (retryCount < this.MAX_RETRIES) {
                console.warn(`Save failed, retrying (${retryCount + 1}/${this.MAX_RETRIES})...`, error);
                setTimeout(() => this.executeSave(retryCount + 1), 1000 * (retryCount + 1));
                return;
            }

            // Max retries exceeded
            console.error('Auto-save failed after retries:', error);
            notify.error(
                'Error al guardar',
                error.message || 'No se pudo guardar el inventario',
                { duration: 7000 }
            );

        } finally {
            this.isSaving = false;
        }
    }

    /**
     * Force immediate save (e.g., when user clicks "Save" button)
     */
    async forceSave(): Promise<boolean> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }

        try {
            await this.executeSave();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges(): boolean {
        return this.queue.length > 0 && this.saveTimer !== null;
    }

    /**
     * Cancel pending save
     */
    cancel() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.cancel();
        this.queue = [];
    }
}
