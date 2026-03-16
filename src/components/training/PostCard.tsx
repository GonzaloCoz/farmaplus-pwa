
import React from "react";
import { TrainingPost } from "@/services/trainingService";
import { Calendar, UserCircle, Tag, ChatDots, Heart } from "@solar-icons/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PostCardProps {
    post: TrainingPost;
    onClick: () => void;
}

export function PostCard({ post, onClick }: PostCardProps) {
    const formattedDate = format(new Date(post.created_at), "d 'de' MMMM", { locale: es });

    return (
        <div 
            onClick={onClick}
            className="group relative flex flex-col bg-white dark:bg-zinc-900 border border-border/40 rounded-[2rem] overflow-hidden hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 cursor-pointer h-full"
        >
            {/* Image placeholder or actual image */}
            <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                {post.image_url ? (
                    <img 
                        src={post.image_url} 
                        alt={post.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                        <div className="p-4 rounded-full bg-zinc-200 dark:bg-zinc-700">
                             <Tag size={40} weight="Bold" />
                        </div>
                    </div>
                )}
                
                {/* Status or Category Badge */}
                <div className="absolute top-4 left-4">
                    <span 
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 text-foreground"
                    >
                        {post.category?.name || "General"}
                    </span>
                </div>
            </div>

            <div className="p-6 flex flex-col flex-1">
                {/* Meta info */}
                <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-4">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={14} weight="Bold" />
                        {formattedDate}
                    </div>
                </div>

                <h3 className="text-xl font-black text-foreground mb-3 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                </h3>

                <p className="text-sm text-muted-foreground/80 font-medium leading-relaxed mb-6 line-clamp-3">
                    {post.snippet || "Haz clic para ver el contenido completo de esta publicación de capacitación."}
                </p>

                {/* Footer with stats and author */}
                <div className="mt-auto pt-6 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {post.author?.full_name?.charAt(0) || "U"}
                        </div>
                        <span className="text-xs font-bold text-foreground">
                            {post.author?.full_name?.split(' ')[0] || "Usuario"}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {post.tags?.length > 0 && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Tag size={14} weight="Bold" />
                                <span className="text-[10px] font-bold capitalize">{post.tags[0]}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
