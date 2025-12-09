import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Plus } from 'lucide-react';
import type { Widget } from '@/types/dashboard';

interface WidgetGalleryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    hiddenWidgets: Widget[];
    onAddWidget: (widgetId: string) => void;
}

export function WidgetGallery({ open, onOpenChange, hiddenWidgets, onAddWidget }: WidgetGalleryProps) {
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>
                <DrawerHeader>
                    <DrawerTitle>Agregar Widgets</DrawerTitle>
                    <DrawerDescription>
                        Selecciona los widgets que deseas agregar al dashboard
                    </DrawerDescription>
                </DrawerHeader>

                <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
                    {hiddenWidgets.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Todos los widgets están visibles en el dashboard</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {hiddenWidgets.map((widget) => {
                                const Icon = widget.icon;
                                return (
                                    <Card key={widget.id} className="hover:border-primary transition-colors">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 rounded-lg bg-primary/10">
                                                        <Icon className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-sm">{widget.title}</CardTitle>
                                                        <CardDescription className="text-xs mt-1">
                                                            {widget.description}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <Button
                                                size="sm"
                                                className="w-full"
                                                onClick={() => {
                                                    onAddWidget(widget.id);
                                                    if (hiddenWidgets.length === 1) {
                                                        onOpenChange(false);
                                                    }
                                                }}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Agregar
                                            </Button>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>

                <DrawerFooter>
                    <DrawerClose asChild>
                        <Button variant="outline">Cerrar</Button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
