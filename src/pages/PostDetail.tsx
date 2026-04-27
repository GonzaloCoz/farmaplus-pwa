
import React, { useEffect, useState } from "react";
import { TiptapViewer } from "@/components/training/TiptapViewer";
import { useParams, useNavigate } from "react-router-dom";
import { trainingService, TrainingPost, TrainingComment } from "@/services/trainingService";
import { useUser } from "@/contexts/UserContext";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { 
    AltArrowLeft as ChevronLeft, 
    Calendar, 
    UserCircle, 
    Heart, 
    ChatDots,
    Tag,
    Share,
    Bookmark,
    Pen,
    TrashBinTrash
} from "@solar-icons/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notifications";

export default function PostDetail() {
    const { id: postId } = useParams();

    const { user } = useUser();
    const navigate = useNavigate();
    const { openWindow } = useWindowManager();
    const [post, setPost] = useState<TrainingPost | null>(null);
    const [comments, setComments] = useState<TrainingComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // Validate that it looks like a UUID (36 chars) or at least isn't a route name like "foro"
        const isUuid = postId && postId.length > 20;
        
        if (isUuid) {
            loadData();
        } else {
            setLoading(false);
        }
    }, [postId]);

    const loadData = async () => {
        if (!postId) return;
        setLoading(true);
        try {
            const [postData, commentsData] = await Promise.all([
                trainingService.getPostById(postId),
                trainingService.getComments(postId)
            ]);
            setPost(postData);
            setComments(commentsData);
            
            // Only mark as read if load was successful
            if (postData) {
                trainingService.markAsRead(postId);
            }
        } catch (error: any) {
            console.error("Error loading post detail:", error);
            if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
                notify.error("No encontrado", "La publicación no existe o no tienes acceso.");
            } else {
                notify.error("Error", "No se pudo cargar la publicación.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || submitting) return;
        setSubmitting(true);
        try {
            await trainingService.addComment(postId, commentText);
            setCommentText("");
            const freshComments = await trainingService.getComments(postId);
            setComments(freshComments);
            notify.success("Comentario enviado", "Tu comentario ha sido publicado.");
        } catch (error) {
            notify.error("Error", "No se pudo enviar el comentario.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-12">
                <Skeleton className="h-8 w-32 mb-8" />
                <Skeleton className="h-12 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-64 w-full rounded-xl mt-8" />
            </div>
        );
    }

    if (!post) return <div className="p-12 text-center">Publicación no encontrada</div>;

    return (
        <div className="flex flex-col min-h-screen bg-background pb-32">
            <article className="max-w-3xl mx-auto w-full px-6 pt-12 md:pt-20">
                {/* Header Meta */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-[15px] text-muted-foreground font-medium">
                        <span>Por</span>
                        <div className="flex items-center gap-1.5 text-foreground font-semibold">
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] overflow-hidden">
                                {post.author?.full_name?.charAt(0) || post.author?.username?.charAt(0) || "U"}
                            </div>
                            {post.author?.full_name?.split(' ')[0] || post.author?.username || "Usuario"}
                        </div>
                        <span>•</span>
                        <span className="capitalize">{post.category?.name?.toLowerCase() || "General"}</span>
                        <span>•</span>
                        <span>{format(new Date(post.created_at), "MMM d, yyyy", { locale: es })}</span>
                    </div>

                    {/* Admin Actions */}
                    {(user?.role === 'admin' || user?.role === 'mod') && (
                        <div className="flex items-center gap-0.5 bg-muted/30 border border-border/50 rounded-full p-1 shadow-sm">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                title="Editar publicación"
                                onClick={() => openWindow(`/foro/admin/edit/${post.id}`, "Editar Recurso")}
                            >
                                <Pen size={18} strokeWidth={2.5} />
                            </Button>
                            <div className="w-px h-4 bg-border/50 mx-1" />
                            <Button 
                                variant="ghost" 
                                className="h-8 px-4 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 text-[13px] font-semibold tracking-tight transition-colors"
                                onClick={async () => {
                                    if (window.confirm("¿Estás seguro de que deseas eliminar esta publicación?")) {
                                        try {
                                            await trainingService.deletePost(post.id);
                                            notify.success("Eliminado", "Publicación eliminada correctamente.");
                                            navigate("/foro");
                                        } catch (error) {
                                            notify.error("Error", "No se pudo eliminar la publicación.");
                                        }
                                    }
                                }}
                            >
                                Eliminar
                            </Button>
                        </div>
                    )}
                </div>

                {/* Title */}
                <h1 className="text-[2.5rem] md:text-[3.5rem] font-bold text-foreground leading-[1.1] tracking-tight mb-8">
                    {post.title}
                </h1>

                {/* Optional Snippet / Intro text */}
                {post.snippet && (
                    <p className="text-xl md:text-[22px] text-muted-foreground leading-relaxed mb-10 font-medium">
                        {post.snippet}
                    </p>
                )}

                {/* Hero Image */}
                {post.image_url && (
                    <div className="w-full mb-16 rounded-lg border border-border/60 bg-muted/20 p-2">
                        <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-muted">
                            <img 
                                src={post.image_url} 
                                alt={post.title} 
                                className="w-full h-full object-cover" 
                            />
                        </div>
                    </div>
                )}
                {/* Rich Content Area */}
                <div className="prose prose-zinc prose-lg md:prose-xl dark:prose-invert max-w-none 
                    prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground
                    prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
                    prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:text-[18px] md:prose-p:text-[20px]
                    prose-a:text-foreground prose-a:font-semibold prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-muted-foreground
                    prose-li:text-muted-foreground prose-li:text-[18px] md:prose-li:text-[20px]
                    prose-strong:text-foreground prose-strong:font-semibold
                    mb-16">
                    {typeof post.content === 'string' ? (
                        /* Standard block text or HTML rendering */
                        <div dangerouslySetInnerHTML={{ __html: post.content }} />
                    ) : (
                        <TiptapViewer content={post.content} />
                    )}
                </div>

                {/* Tags (if any) */}
                {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-16 pt-8 border-t border-border/40">
                        {post.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 rounded-full bg-muted/50 text-muted-foreground text-[13px] font-medium transition-colors hover:text-foreground hover:bg-muted cursor-pointer">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </article>

            {/* Comments Section */}
            <div className="max-w-3xl mx-auto w-full px-6 mt-8">
                <div className="flex items-center gap-3 mb-8">
                    <ChatDots size={24} className="text-foreground" />
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Comentarios ({comments.length})</h2>
                </div>

                {/* New Comment Box */}
                <div className="bg-background border border-border/60 rounded-lg p-4 shadow-sm mb-12 focus-within:border-border transition-colors">
                    <Textarea 
                        placeholder="Dejá un comentario o pregunta..." 
                        className="min-h-[80px] border-none bg-transparent resize-none text-[16px] focus-visible:ring-0 p-2 placeholder:text-muted-foreground/60"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                    />
                    <div className="flex justify-end mt-2">
                        <Button 
                            className="rounded-full font-semibold px-6"
                            onClick={handleAddComment}
                            disabled={!commentText.trim() || submitting}
                        >
                            {submitting ? "Publicando..." : "Comentar"}
                        </Button>
                    </div>
                </div>

                {/* Comments List */}
                <div className="space-y-8">
                    {comments.map(comment => (
                        <div key={comment.id} className="flex gap-4 group">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-sm shrink-0 text-foreground">
                                {comment.author?.full_name?.charAt(0) || comment.author?.username?.charAt(0) || "U"}
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[15px] text-foreground">{comment.author?.full_name || comment.author?.username || "Usuario"}</span>
                                    <span className="text-[13px] text-muted-foreground">
                                        • {format(new Date(comment.created_at), "MMM d", { locale: es })}
                                    </span>
                                </div>
                                <p className="text-[15px] text-muted-foreground leading-relaxed">
                                    {comment.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

