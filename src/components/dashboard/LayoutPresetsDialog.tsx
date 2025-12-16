import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LAYOUT_PRESETS } from '@/config/widgetPresets';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface LayoutPresetsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApplyPreset: (presetId: string) => void;
}

export function LayoutPresetsDialog({ open, onOpenChange, onApplyPreset }: LayoutPresetsDialogProps) {
    const handleApply = (presetId: string) => {
        onApplyPreset(presetId);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Layouts Predefinidos</DialogTitle>
                    <DialogDescription>
                        Selecciona un layout predefinido para configurar tu dashboard rápidamente
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {LAYOUT_PRESETS.map((preset) => {
                        const Icon = preset.icon;
                        return (
                            <Card
                                key={preset.id}
                                className={cn(
                                    'p-4 cursor-pointer transition-all hover:border-primary hover:shadow-md',
                                    'flex flex-col gap-3'
                                )}
                                onClick={() => handleApply(preset.id)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-base">{preset.name}</h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {preset.description}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Check className="h-3 w-3" />
                                    <span>{preset.widgetIds.length} widgets incluidos</span>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleApply(preset.id);
                                    }}
                                >
                                    Aplicar Layout
                                </Button>
                            </Card>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
