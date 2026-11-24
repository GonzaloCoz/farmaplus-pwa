import React from "react";
import { CheckCircle as CheckCircle2, Edit01 as FileEdit, Trash01 as Trash2, EyeOff, Plus, Calendar, User01 as UserCircle } from '@untitledui/icons';
import { cn } from "@/lib/utils";
import { 
  ScrollArea,
  ScrollAreaViewport,
  ScrollAreaScrollbar
} from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TrainingPost } from "@/services/trainingService";

interface SidebarItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: 'draft' | 'published' | 'archived';
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { 
    id: 'activas', 
    label: 'Activas', 
    description: 'Publicaciones visibles', 
    icon: <CheckCircle2 className="h-5 w-5" />,
    status: 'published'
  },
  { 
    id: 'desactivadas', 
    label: 'Desactivadas', 
    description: 'Oculto al público', 
    icon: <EyeOff className="h-5 w-5" />,
    status: 'archived'
  },
  { 
    id: 'borradores', 
    label: 'Borradores', 
    description: 'En edición', 
    icon: <FileEdit className="h-5 w-5" />,
    status: 'draft'
  },
  { 
    id: 'eliminadas', 
    label: 'Eliminadas', 
    description: 'Papelera de reciclaje', 
    icon: <Trash2 className="h-5 w-5" />,
    status: 'archived'
  },
];

interface SidebarPostCardProps {
    post: TrainingPost;
    isActive: boolean;
    onClick: () => void;
}

function SidebarPostCard({ post, isActive, onClick }: SidebarPostCardProps) {
    const formattedDate = format(new Date(post.created_at), "d 'de' MMM", { locale: es });
    
    return (
        <div 
            onClick={onClick}
            className={cn(
                "group relative flex flex-col bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer mb-3",
                isActive 
                    ? "border-primary ring-1 ring-primary/20 shadow-sm" 
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm"
            )}
        >
            <div className="p-1 px-1.5 pt-1.5">
                <div className="aspect-[16/8] w-full bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden rounded-lg">
                    {post.image_url ? (
                        <img 
                            src={post.image_url} 
                            alt={post.title} 
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-10">
                            <FileEdit size={24} className="text-zinc-500" />
                        </div>
                    )}
                </div>
            </div>

            <div className="p-3 pt-2 flex flex-col">
                <span className="text-[10px] font-medium text-zinc-400 mb-1">
                    {formattedDate}
                </span>
                <h4 className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100 line-clamp-2 leading-tight mb-1 font-sans">
                    {post.title || "Sin título"}
                </h4>
                <p className="text-[11px] text-zinc-500 line-clamp-2 leading-snug h-8">
                    {post.snippet || "Sin descripción disponible."}
                </p>
            </div>
        </div>
    );
}

interface EditorSidebarLeftProps {
  activeStatus: string;
  onStatusSelect: (status: any) => void;
  posts: TrainingPost[];
  currentPostId?: string;
  onPostSelect: (id: string) => void;
  onCreateNew: () => void;
}

export function EditorSidebarLeft({ 
    activeStatus, 
    onStatusSelect, 
    posts, 
    currentPostId, 
    onPostSelect, 
    onCreateNew 
}: EditorSidebarLeftProps) {
  
  const filteredPosts = posts.filter(p => p.status === activeStatus);

  return (
    <aside className="w-[280px] border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex flex-col">
      
      {/* Create Button Section */}
      <div className="p-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <button
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl h-10 text-xs font-bold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
        >
          <Plus size={16} strokeWidth={3} />
          Crear publicación
        </button>
      </div>

      {/* Filters Section */}
      <nav className="px-3 py-4 space-y-1">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onStatusSelect(item.status)}
            className={cn(
              "w-full flex items-center gap-3 p-2 px-3 rounded-xl transition-all duration-200",
              activeStatus === item.status
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/50 dark:border-zinc-800/50"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
            )}
          >
            <div className={cn(
               activeStatus === item.status ? "text-primary" : "text-zinc-400"
            )}>
              {item.icon}
            </div>
            <span className="text-[12px] font-bold tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Posts List Section */}
      <div className="flex-1 flex flex-col min-h-0 bg-white/50 dark:bg-black/10 border-t border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden">
        <div className="p-4 py-3 flex items-center justify-between">
           <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
             {activeStatus === 'published' ? 'Activas' : activeStatus === 'draft' ? 'Borradores' : 'Archivadas'}
           </span>
           <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
             {filteredPosts.length}
           </span>
        </div>

        <ScrollArea className="flex-1">
            <ScrollAreaViewport className="h-full px-4">
                <div className="pb-8">
                    {filteredPosts.length > 0 ? (
                        filteredPosts.map(post => (
                            <SidebarPostCard 
                                key={post.id}
                                post={post}
                                isActive={currentPostId === post.id}
                                onClick={() => onPostSelect(post.id)}
                            />
                        ))
                    ) : (
                        <div className="py-20 flex flex-col items-center text-center px-4">
                            <FileEdit size={32} className="text-zinc-200 mb-4" />
                            <p className="text-[11px] font-medium text-zinc-400">No hay publicaciones en esta categoría</p>
                        </div>
                    )}
                </div>
            </ScrollAreaViewport>
            <ScrollAreaScrollbar />
        </ScrollArea>
      </div>

    </aside>
  );
}
