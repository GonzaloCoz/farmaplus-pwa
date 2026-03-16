
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { trainingService, TrainingPost, TrainingComment } from "@/services/trainingService";
import { useUser } from "@/contexts/UserContext";
import { 
    AltArrowLeft as ChevronLeft, 
    Calendar, 
    UserCircle, 
    Heart, 
    ChatDots,
    Tag,
    Share,
    Bookmark
} from "@solar-icons/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notifications";

export default function PostDetail() {
    // Note: Since we are in a WindowRouter, the "path" is passed as a prop, 
    // but useParams might not work if it's not a standard Route.
    // However, the WindowRouter logic uses location.pathname.
    const path = window.location.pathname;
    const postId = path.split('/').pop() || "";

    const { user } = useUser();
    const [post, setPost] = useState<TrainingPost | null>(null);
    const [comments, setComments] = useState<TrainingComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (postId) {
            loadData();
            trainingService.markAsRead(postId);
        }
    }, [postId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [postData, commentsData] = await Promise.all([
                trainingService.getPostById(postId),
                trainingService.getComments(postId)
            ]);
            setPost(postData);
            setComments(commentsData);
        } catch (error) {
            console.error("Error loading post detail:", error);
            notify.error("Error", "No se pudo cargar la publicación.");
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
                <Skeleton className="h-64 w-full rounded-3xl mt-8" />
            </div>
        );
    }

    if (!post) return <div className="p-12 text-center">Publicación no encontrada</div>;

    return (
        <div className="flex flex-col min-h-screen bg-transparent pb-40">
            {/* Background Cover */}
            <div className="h-64 w-full bg-zinc-100 dark:bg-zinc-800 relative z-0">
                {post.image_url && (
                    <img src={post.image_url} alt="" className="w-full h-full object-cover opacity-50" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            </div>

            <div className="max-w-4xl mx-auto w-full px-6 -mt-32 relative z-10">
                {/* Post Header */}
                <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-border/40 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-black/5 mb-10">
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-black uppercase tracking-widest">
                            {post.category?.name || "Capacitación"}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                            <Calendar size={14} weight="Bold" />
                            {format(new Date(post.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-foreground mb-8 leading-[1.1] tracking-tight">
                        {post.title}
                    </h1>

                    <div className="flex items-center justify-between py-6 border-y border-border/40">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-black text-lg">
                                {post.author?.full_name?.charAt(0) || "U"}
                            </div>
                            <div>
                                <p className="font-black text-foreground">{post.author?.full_name || "Admin"}</p>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Farmaplus Team</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                             <Button variant="outline" size="icon" className="rounded-2xl border-border/40 bg-transparent">
                                <Heart size={20} />
                             </Button>
                             <Button variant="outline" size="icon" className="rounded-2xl border-border/40 bg-transparent">
                                <Share size={20} />
                             </Button>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="mt-12 text-lg leading-relaxed text-foreground/90 font-medium space-y-6 whitespace-pre-wrap">
                        {/* 
                          Handling rich text or plain text content. 
                          If content is an object (blocks), we should map it.
                          For now, showing the snippet if content is missing, or string content.
                        */}
                        {typeof post.content === 'string' ? post.content : JSON.stringify(post.content, null, 2)}
                    </div>

                    {/* Tags */}
                    <div className="mt-12 flex flex-wrap gap-2">
                        {post.tags?.map(tag => (
                            <span key={tag} className="px-4 py-2 rounded-xl bg-muted/50 text-muted-foreground text-xs font-bold lowercase border border-border/40">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Comments Section */}
                <div className="space-y-8 px-4">
                    <div className="flex items-center gap-3 mb-8">
                        <ChatDots size={28} weight="Bold" className="text-primary" />
                        <h2 className="text-2xl font-black text-foreground">Comentarios ({comments.length})</h2>
                    </div>

                    {/* New Comment */}
                    <div className="bg-white dark:bg-zinc-900 border border-border/40 rounded-[2rem] p-6 shadow-xl shadow-black/5 mb-12">
                        <Textarea 
                            placeholder="Escribe un comentario o deja una duda..." 
                            className="min-h-[100px] border-none bg-transparent resize-none text-base focus-visible:ring-0 p-2"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                        />
                        <div className="flex justify-end mt-4 pt-4 border-t border-border/40">
                             <Button 
                                className="rounded-2xl font-black px-8 h-12 shadow-lg shadow-primary/20"
                                onClick={handleAddComment}
                                disabled={!commentText.trim() || submitting}
                             >
                                {submitting ? "Publicando..." : "Comentar"}
                             </Button>
                        </div>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-6">
                        {comments.map(comment => (
                            <div key={comment.id} className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm shrink-0">
                                    {comment.author?.full_name?.charAt(0) || "U"}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <span className="font-black text-foreground">{comment.author?.full_name || "Usuario"}</span>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            {format(new Date(comment.created_at), "d MMM", { locale: es })}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-foreground/80 leading-relaxed bg-muted/30 p-4 rounded-2xl rounded-tl-none border border-border/20">
                                        {comment.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
