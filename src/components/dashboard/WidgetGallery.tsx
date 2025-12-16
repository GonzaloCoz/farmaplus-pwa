import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Plus, Search, Star } from 'lucide-react';
import type { Widget } from '@/types/dashboard';
import { WIDGET_CATEGORIES, WIDGET_CATEGORY_MAP } from '@/config/widgetCategories';
import { cn } from '@/lib/utils';

interface WidgetGalleryProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    hiddenWidgets: Widget[];
    onAddWidget: (widgetId: string) => void;
}

// Widgets populares (basado en uso común)
const POPULAR_WIDGETS = new Set([
    'metrics-carousel',
    'active-products',
    'inventory-alerts',
    'trends-chart',
    'quick-actions',
]);

export function WidgetGallery({ open, onOpenChange, hiddenWidgets, onAddWidget }: WidgetGalleryProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Filtrar widgets por búsqueda y categoría
    const filteredWidgets = useMemo(() => {
        let filtered = hiddenWidgets;

        // Filtrar por búsqueda
        if (searchQuery) {
            filtered = filtered.filter(
                (widget) =>
                    widget.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    widget.description.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Filtrar por categoría
        if (selectedCategory) {
            filtered = filtered.filter(
                (widget) => WIDGET_CATEGORY_MAP[widget.type] === selectedCategory
            );
        }

        return filtered;
    }, [hiddenWidgets, searchQuery, selectedCategory]);

    // Agrupar widgets por categoría
    const widgetsByCategory = useMemo(() => {
        const grouped: Record<string, Widget[]> = {};
        filteredWidgets.forEach((widget) => {
            const categoryId = WIDGET_CATEGORY_MAP[widget.type] || 'other';
            if (!grouped[categoryId]) {
                grouped[categoryId] = [];
            }
            grouped[categoryId].push(widget);
        });
        return grouped;
    }, [filteredWidgets]);

    const handleAddWidget = (widgetId: string) => {
        onAddWidget(widgetId);
        if (hiddenWidgets.length === 1) {
            onOpenChange(false);
        }
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[90vh]">
                <DrawerHeader>
                    <DrawerTitle>Galería de Widgets</DrawerTitle>
                    <DrawerDescription>
                        Explora y agrega widgets para personalizar tu dashboard
                    </DrawerDescription>
                </DrawerHeader>

                <div className="px-4 space-y-4">
                    {/* Barra de búsqueda */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar widgets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Filtros de categoría */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <Button
                            variant={selectedCategory === null ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory(null)}
                        >
                            Todos
                        </Button>
                        {Object.values(WIDGET_CATEGORIES).map((category) => {
                            const Icon = category.icon;
                            const count = hiddenWidgets.filter(
                                (w) => WIDGET_CATEGORY_MAP[w.type] === category.id
                            ).length;

                            if (count === 0) return null;

                            return (
                                <Button
                                    key={category.id}
                                    variant={selectedCategory === category.id ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedCategory(category.id)}
                                    className="flex items-center gap-2"
                                >
                                    <Icon className="h-4 w-4" />
                                    {category.name}
                                    <Badge variant="secondary" className="ml-1">
                                        {count}
                                    </Badge>
                                </Button>
                            );
                        })}
                    </div>
                </div>

                {/* Lista de widgets */}
                <div className="px-4 pb-4 max-h-[50vh] overflow-y-auto">
                    {filteredWidgets.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <p className="text-lg font-medium">
                                {hiddenWidgets.length === 0
                                    ? 'Todos los widgets están visibles'
                                    : 'No se encontraron widgets'}
                            </p>
                            {searchQuery && (
                                <p className="text-sm mt-2">
                                    Intenta con otra búsqueda o categoría
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(widgetsByCategory).map(([categoryId, widgets]) => {
                                const category = WIDGET_CATEGORIES[categoryId];
                                if (!category || widgets.length === 0) return null;

                                const CategoryIcon = category.icon;

                                return (
                                    <div key={categoryId} className="space-y-3">
                                        <div className="flex items-center gap-2 sticky top-0 bg-background py-2 z-10">
                                            <CategoryIcon className="h-5 w-5 text-primary" />
                                            <h3 className="font-semibold">{category.name}</h3>
                                            <Badge variant="outline">{widgets.length}</Badge>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {widgets.map((widget) => {
                                                const Icon = widget.icon;
                                                const isPopular = POPULAR_WIDGETS.has(widget.id);

                                                return (
                                                    <Card
                                                        key={widget.id}
                                                        className={cn(
                                                            'hover:border-primary transition-all hover:shadow-md',
                                                            isPopular && 'border-primary/50'
                                                        )}
                                                    >
                                                        <CardHeader className="pb-3">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    <div className="p-2 rounded-lg bg-primary/10">
                                                                        <Icon className="h-4 w-4 text-primary" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <CardTitle className="text-sm truncate">
                                                                                {widget.title}
                                                                            </CardTitle>
                                                                            {isPopular && (
                                                                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                                                                            )}
                                                                        </div>
                                                                        <CardDescription className="text-xs mt-1 line-clamp-2">
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
                                                                onClick={() => handleAddWidget(widget.id)}
                                                            >
                                                                <Plus className="h-4 w-4 mr-2" />
                                                                Agregar
                                                            </Button>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
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
