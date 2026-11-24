
import React, { useEffect, useState, useMemo } from "react";
import { trainingService, TrainingPost, TrainingCategory } from "@/services/trainingService";
import { useUser } from "@/contexts/UserContext";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { SearchLg as Search, PlusCircle as Plus } from '@untitledui/icons';
import { ArrowRight as ArrowRightIcon } from '@untitledui/icons';
import { PostCard } from "@/components/training/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


type SortOption = "newest" | "oldest" | "title-asc" | "title-desc";

export default function TrainingCenter() {
    const { user } = useUser();
    const { openWindow } = useWindowManager();
    const [posts, setPosts] = useState<TrainingPost[]>([]);
    const [categories, setCategories] = useState<TrainingCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>("newest");

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        loadPosts();
    }, [search, selectedCategory]);

    const loadInitialData = async () => {
        try {
            const cats = await trainingService.getCategories();
            setCategories(cats);
        } catch (error) {
            console.error("Error loading categories:", error);
        }
    };

    const loadPosts = async () => {
        setLoading(true);
        try {
            const data = await trainingService.getPosts({
                search,
                categoryId: selectedCategory || undefined
            });
            setPosts(data);
        } catch (error) {
            console.error("Error loading posts:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPosts = useMemo(() => {
        let result = [...posts];
        if (search) {
            const term = search.toLowerCase();
            result = result.filter(p => p.title?.toLowerCase().includes(term));
        }
        result.sort((a, b) => {
            switch (sortBy) {
                case "oldest": return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                case "title-asc": return (a.title || '').localeCompare(b.title || '');
                case "title-desc": return (b.title || '').localeCompare(a.title || '');
                case "newest":
                default: return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            }
        });
        return result;
    }, [posts, search, sortBy]);

    const isAdmin = user?.role === 'admin';

    return (
        <div className="flex flex-col min-h-screen bg-transparent pb-20">
            {/* Hero / Intro Section — cal.com blog style */}
            <div className="px-6 md:px-10 lg:px-16 pt-10 md:pt-16 pb-6 md:pb-6 max-w-5xl">
                <Badge variant="solid" className="mb-4 bg-background/50 rounded-full text-xs font-semibold px-3 py-1 text-muted-foreground border-border/40 backdrop-blur-sm pointer-events-none">
                    Centro de Capacitación
                </Badge>
                <p className="text-[clamp(1.25rem,3vw,1.75rem)] font-medium text-muted-foreground leading-[1.5] tracking-tight">
                    Explorá guías prácticas, protocolos actualizados y recursos de formación del equipo Farmaplus.{' '}
                    <span className="text-foreground font-semibold">
                        Todo lo que necesitás para crecer profesionalmente, en un solo lugar.
                    </span>
                </p>
            </div>

            {/* Category Pills + Search */}
            <div className="sticky top-0 z-20 pb-4">
                <div className="px-6 md:px-10 lg:px-16 py-3 flex items-center gap-4">
                    {/* Category Pills & Search */}
                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-1 min-w-0">
                        <Button
                            variant={!selectedCategory ? "secondary" : "tertiary"}
                            size="sm"
                            onClick={() => setSelectedCategory(null)}
                            className={cn(
                                "whitespace-nowrap rounded-full px-4 h-8 text-[12px] font-semibold transition-all shrink-0",
                                !selectedCategory ? "pointer-events-none" : "text-muted-foreground"
                            )}
                        >
                            Todas las categorías
                        </Button>
                        {categories.map(cat => (
                            <Button
                                key={cat.id}
                                variant={selectedCategory === cat.id ? "secondary" : "tertiary"}
                                size="sm"
                                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                                className={cn(
                                    "whitespace-nowrap rounded-full px-4 h-8 text-[12px] font-semibold transition-all shrink-0",
                                    selectedCategory === cat.id ? "pointer-events-none" : "text-muted-foreground"
                                )}
                            >
                                {cat.name}
                            </Button>
                        ))}
                        
                        {/* Search Field - Directly next to pills */}
                        <div className="relative shrink-0 ml-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar publicación…"
                                className="h-8 w-44 md:w-56 pl-9 pr-3 rounded-full bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all"
                            />
                        </div>
                    </div>

                    {/* Admin Actions */}
                    <div className="flex items-center shrink-0">
                        {isAdmin && (
                            <Button
                                className="h-8 px-4 font-bold shadow-sm shrink-0 ml-4 rounded-full"
                                onClick={() => openWindow("/foro/admin/edit", "Nuevo Recurso")}
                            >
                                Crear
                                <ArrowRightIcon
                                    aria-hidden="true"
                                    className="ml-1 -mr-1 h-4 w-4 in-[[data-slot=button]:hover]:translate-x-0.5 transition-transform"
                                />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Grid of Posts */}
            <div className={cn(
                "px-6 md:px-10 lg:px-16 pt-8",
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            )}>
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-card rounded-lg p-4 border border-border/30">
                            <Skeleton className="aspect-video w-full rounded-xl mb-4" />
                            <Skeleton className="h-5 w-3/4 mb-3" />
                            <Skeleton className="h-4 w-full mb-1.5" />
                            <Skeleton className="h-4 w-5/6" />
                        </div>
                    ))
                ) : filteredPosts.length > 0 ? (
                    filteredPosts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            onClick={() => openWindow(`/foro/${post.id}`)}
                        />
                    ))
                ) : (
                    <div className="col-span-full py-24 flex flex-col items-center text-muted-foreground">
                        <Search size={48} className="opacity-15 mb-4" />
                        <p className="font-semibold text-lg">No se encontraron publicaciones</p>
                        <p className="text-sm mt-1">Intentá con otros criterios de búsqueda.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

