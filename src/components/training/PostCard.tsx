
import React from "react";
import { TrainingPost } from "@/services/trainingService";
import { Calendar, User01 as UserCircle, Tag01 as Tag, MessageSquare01 as ChatDots, Heart } from '@untitledui/icons';
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
            className="group relative flex flex-col bg-background border border-border/60 rounded-lg overflow-hidden hover:border-border hover:shadow-md transition-all duration-300 cursor-pointer h-full"
        >
            {/* Image Section with outer padding */}
            <div className="p-2 pb-0">
                <div className="aspect-[16/10] w-full bg-muted relative overflow-hidden rounded-xl">
                    {post.image_url ? (
                        <img 
                            src={post.image_url} 
                            alt={post.title} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20">
                            <Tag size={40} className="text-muted-foreground" />
                        </div>
                    )}
                </div>
            </div>

            <div className="p-5 flex flex-col flex-1">
                {/* Date */}
                <span className="text-[13px] font-medium text-muted-foreground mb-3">
                    {formattedDate}
                </span>

                {/* Title */}
                <h3 className="text-[20px] font-semibold text-foreground mb-2 leading-tight tracking-tight group-hover:underline decoration-foreground/20 underline-offset-4">
                    {post.title}
                </h3>

                {/* Snippet */}
                <p className="text-[14px] text-muted-foreground leading-relaxed mb-6 line-clamp-3">
                    {post.snippet || "Haz clic para ver el contenido completo de esta publicación de capacitación."}
                </p>

                {/* Footer with author and category */}
                <div className="mt-auto flex items-center gap-2 text-[13px]">
                    <span className="text-muted-foreground">Por</span>
                    
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-foreground font-semibold text-[10px] overflow-hidden">
                            {post.author?.full_name?.charAt(0) || post.author?.username?.charAt(0) || "U"}
                        </div>
                        <span className="font-semibold text-foreground">
                            {post.author?.full_name?.split(' ')[0] || post.author?.username || "Usuario"}
                        </span>
                    </div>

                    <span className="text-muted-foreground px-1">•</span>
                    
                    <span className="text-muted-foreground font-medium">
                        #{post.category?.name?.replace(/\s+/g, '') || "General"}
                    </span>
                </div>
            </div>
        </div>
    );
}

