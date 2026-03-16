
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { trainingService, TrainingPost, TrainingCategory } from "@/services/trainingService";
import { useUser } from "@/contexts/UserContext";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { Magnifer as Search, Filter, MenuDots as MoreVertical, Widget as GridIcon, List as ListIcon, SortVertical as SortIcon, AddCircle as Plus } from "@solar-icons/react";
import { PostCard } from "@/components/training/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SortOption = "newest" | "oldest" | "title-asc" | "title-desc";

export default function TrainingCenter() {
    const { user } = useUser();
    const { openWindow } = useWindowManager();
    const [posts, setPosts] = useState<TrainingPost[]>([]);
    const [categories, setCategories] = useState<TrainingCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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
            {/* Toolbar — Transparent and Fixed */}
            <div className="flex items-center justify-between sticky top-0 z-20 py-4 px-6 gap-6 mb-4 bg-transparent backdrop-blur-none border-none transition-all">
                <div className="flex items-center gap-8 min-w-0 flex-1">
                    {/* Subtle Title & Description */}
                    <div className="flex flex-col shrink-0">
                        <h1 className="text-sm font-bold text-foreground leading-none">Centro de Capacitación</h1>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">Recursos y guías para tu sucursal</p>
                    </div>

                    {/* Category Filters (No "Todo" button) */}
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar min-w-0">
                        {categories.map(cat => (
                            <Button
                                key={cat.id}
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                                className={cn(
                                    "whitespace-nowrap rounded-xl px-4 h-8 text-[11px] font-bold transition-all",
                                    selectedCategory === cat.id
                                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm"
                                        : "bg-white/40 dark:bg-white/5 text-muted-foreground hover:bg-white/60 dark:hover:bg-white/10"
                                )}
                            >
                                {cat.name}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Action Toolbar */}
                <div className="flex items-center gap-1.5 flex-1 justify-end">
                    {/* Expandable Search */}
                    <div className="flex items-center">
                        <motion.div
                            initial={false}
                            animate={{ 
                                width: isSearchExpanded ? (window.innerWidth < 768 ? '160px' : '240px') : '36px',
                                opacity: 1
                            }}
                            className="relative flex items-center h-9 bg-white/40 dark:bg-[#2a2a2a]/40 rounded-xl border-none overflow-hidden"
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 hover:bg-white dark:hover:bg-white/10 transition-colors"
                                onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                            >
                                <Search className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar publicación..."
                                className={cn(
                                    "bg-transparent border-none focus:outline-none text-sm w-full pr-3 transition-opacity duration-300",
                                    isSearchExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
                                )}
                            />
                        </motion.div>
                    </div>

                    {/* Sort/Filter Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/40 dark:bg-[#2a2a2a]/40 group">
                                <Filter className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                            <DropdownMenuItem onClick={() => setSortBy("newest")} className="rounded-lg text-xs font-semibold">Más Recientes</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy("oldest")} className="rounded-lg text-xs font-semibold">Más Antiguos</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy("title-asc")} className="rounded-lg text-xs font-semibold">Título (A-Z)</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy("title-desc")} className="rounded-lg text-xs font-semibold">Título (Z-A)</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* More Options */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/40 dark:bg-[#2a2a2a]/40 group">
                                <MoreVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl p-1">
                            {isAdmin && (
                                <DropdownMenuItem onClick={() => openWindow("/foro/admin/edit", "Nuevo Recurso")} className="rounded-lg text-xs font-semibold">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Nueva Publicación
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="rounded-lg text-xs font-semibold">Actualizar</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Grid / List Toggle */}
                    <div className="flex p-1 bg-card/40 dark:bg-[#1e1e1e] rounded-xl border border-border/50 shadow-sm">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "h-7 w-8 rounded-[10px] transition-all",
                                viewMode === 'grid' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <GridIcon className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "h-7 w-8 rounded-[10px] transition-all",
                                viewMode === 'list' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <ListIcon className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Grid of Posts */}
            <div className={cn(
                "px-6",
                viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    : "flex flex-col gap-2"
            )}>
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-zinc-900/50 rounded-2xl p-4 border border-border/40">
                            <Skeleton className="h-40 w-full rounded-xl mb-4" />
                            <Skeleton className="h-6 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-full mb-1" />
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
                    <div className="col-span-full py-20 flex flex-col items-center text-muted-foreground">
                        <Search size={48} className="opacity-20 mb-4" />
                        <p className="font-semibold text-lg">No se encontraron publicaciones</p>
                        <p className="text-sm">Intenta con otros criterios de búsqueda.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
