import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TiptapEditor } from "../components/training/TiptapEditor";
import { TiptapToolbar } from "../components/training/TiptapToolbar";
import { EditorHeader } from "../components/training/EditorHeader";
import { EditorSidebarLeft } from "../components/training/EditorSidebarLeft";
import { cn } from "@/lib/utils";
import { trainingService, TrainingPost } from "../services/trainingService";
import { notify } from "@/lib/notifications";
import { useUser } from "../contexts/UserContext";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { Label } from "@/components/ui/label";
import { 
    ScrollArea, 
    ScrollAreaViewport, 
    ScrollAreaScrollbar 
} from "../components/ui/scroll-area";
import { 
    Combobox, 
    ComboboxChip, 
    ComboboxChips, 
    ComboboxChipsInput, 
    ComboboxEmpty, 
    ComboboxItem, 
    ComboboxList, 
    ComboboxPopup, 
    ComboboxValue 
} from "@/components/ui/combobox";
import { SearchIcon, Plus, FileEdit } from "lucide-react";
import { PageTransition } from "../components/PageTransition";
import { Button } from "@/components/ui/button";
import { TrainingCategory } from "../services/trainingService";


export default function AdminEditor() {
    const { id } = useParams();
    const { user: localUser } = useUser();
    const navigate = useNavigate();
    const { openWindow } = useWindowManager();
    
    // Editor State
    const [title, setTitle] = useState("Nueva Publicación");
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(!!id);
    const [saving, setSaving] = useState(false);
    const [editor, setEditor] = useState<any>(null);
    const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
    
    // Sidebar State
    const [allPosts, setAllPosts] = useState<TrainingPost[]>([]);
    
    // Categories State
    const [availableCategories, setAvailableCategories] = useState<{ label: string; value: string }[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<{ label: string; value: string }[]>([]);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadAllPosts();
        fetchCategories();
        // Validate that it looks like a UUID (36 chars) or at least isn't a route name
        const isUuid = id && id.length > 20;
        
        if (isUuid) {
            loadPost();
        } else {
            resetEditor();
        }
    }, [id]);

    const fetchCategories = async () => {
        try {
            const cats = await trainingService.getCategories();
            setAvailableCategories(cats.map(c => ({ label: c.name, value: c.id })));
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const loadAllPosts = async () => {
        try {
            const posts = await trainingService.getAdminPosts();
            setAllPosts(posts);
        } catch (error) {
            console.error("Error loading sidebar posts:", error);
        }
    };

    const resetEditor = () => {
        setTitle("");
        setContent(null);
        setStatus('draft');
        setSelectedCategories([]);
        setLoading(false);
    };

    const loadPost = async () => {
        setLoading(true);
        try {
            const post = await trainingService.getPostById(id!);
            setTitle(post.title || "Sin Título");
            setContent(post.content);
            setStatus(post.status as any || 'draft');
            
            // Map tags back to categories for the combobox
            if (post.tags && post.tags.length > 0) {
                // If we have categories loaded, we can map names to values
                // But simplified: we just use the tags as labels and values if they were IDs
                // Actually, let's assume tags are names or IDs.
                // Re-hydrating exactly might be complex without a full lookup.
                // For now, let's just initialize it.
                const hydrated = post.tags.map(t => ({ label: t, value: t }));
                setSelectedCategories(hydrated);
            } else if (post.category) {
                setSelectedCategories([{ label: post.category.name, value: post.category.id }]);
            }
        } catch (error: any) {
            console.error("Error loading post:", error);
            if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
                notify.error("No encontrado", "La publicación no existe o ha sido eliminada.");
                resetEditor();
                setIsCreating(false);
                navigate('/foro/admin/edit');
            } else {
                notify.error("Error", "No se pudo cargar la publicación.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (overriddenStatus?: 'draft' | 'published' | 'archived', silent = false) => {
        // If silent and empty, don't bother saving anything
        const currentContent = editor?.getJSON() || content;
        const hasText = editor?.getText()?.trim()?.length > 0;
        const hasSignificantContent = title.trim().length > 0 || hasText;

        if (silent && !hasSignificantContent) return;

        if (!title.trim() && !silent) {
            notify.error("Error", "La publicación debe tener un título.");
            return;
        }

        const finalStatus = overriddenStatus || status;

        if (!silent) setSaving(true);
        try {
            const postData: Partial<TrainingPost> = {
                title,
                content: currentContent || { type: 'doc', content: [] },
                status: finalStatus,
                category_id: selectedCategories.length > 0 ? selectedCategories[0].value : undefined,
                tags: selectedCategories.map(c => c.label),
            };
            
            if (id) {
                await trainingService.updatePost(id, postData, localUser?.id);
            } else {
                const newPost = await trainingService.createPost(postData, localUser?.id);
                if (newPost?.id) {
                    setIsCreating(false);
                    if (!silent) {
                        navigate(`/foro/admin/edit/${newPost.id}`, { replace: true });
                    } else {
                        // Silent save (like when switching) should still update the sidebar but we navigate away anyway
                        // So no need to replace URL here
                    }
                }
                return newPost?.id;
            }
            if (!silent) notify.success("Éxito", `Publicación guardada.`);
            loadAllPosts(); // Refresh sidebar
        } catch (error: any) {
            if (!silent) {
                console.error("HandleSave Error:", error);
                notify.error("Error", error.message || "No se pudo guardar.");
            }
        } finally {
            if (!silent) setSaving(false);
        }
    };

    const handleSidebarPostSelect = async (newId: string) => {
        if (newId === id) return;
        
        // Autosave current work as draft before navigating, ONLY if there is significant content
        // and we are either editing an existing post or we were explicitly creating one.
        const hasTitle = title.trim().length > 0;
        const hasText = editor?.getText()?.trim()?.length > 0;
        
        if ((id || isCreating) && (hasTitle || hasText)) {
            await handleSave('draft', true);
        }
        
        setIsCreating(false);
        navigate(`/foro/admin/edit/${newId}`);
    };

    const handleCreateNew = async () => {
        if (isCreating) return; // Already creating
        
        // Autosave current work as draft if we were editing
        const hasTitle = title.trim().length > 0;
        const hasText = editor?.getText()?.trim()?.length > 0;
        
        if (id && (hasTitle || hasText)) {
            await handleSave('draft', true);
        }
        
        resetEditor();
        setIsCreating(true);
        navigate(`/foro/admin/edit`, { replace: true });
    };

    const handlePreview = async () => {
        if (!id) {
            notify.info("Atención", "Guardaremos un borrador primero para generar la vista previa.");
            try {
                const postData: Partial<TrainingPost> = {
                    title,
                    content: editor?.getJSON() || content,
                    status: 'draft',
                };
                const newPost = await trainingService.createPost(postData, localUser?.id);
                if (newPost?.id) {
                    window.open(`/foro/${newPost.id}`, '_blank');
                    navigate(`/foro/admin/edit/${newPost.id}`, { replace: true });
                }
            } catch (error) {
                notify.error("Error", "No se pudo generar la vista previa.");
            }
            return;
        }
        window.open(`/foro/${id}`, '_blank');
    };

    const handleDelete = async () => {
        if (!id) {
            resetEditor();
            setIsCreating(false);
            navigate('/foro/admin/edit');
            return;
        }

        if (!confirm("¿Estás seguro de que deseas eliminar permanentemente esta publicación?")) return;

        setSaving(true);
        try {
            await trainingService.deletePost(id);
            notify.success("Eliminado", "La publicación ha sido eliminada permanentemente.");
            loadAllPosts();
            resetEditor();
            setIsCreating(false);
            navigate('/foro/admin/edit');
        } catch (error) {
            notify.error("Error", "No se pudo eliminar la publicación.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

    return (
        <div className="flex flex-col h-screen bg-[#f8f9fb] dark:bg-zinc-950 overflow-hidden font-sans text-zinc-900">
            <EditorHeader 
                title={id ? title : "Nueva Publicación"}
                status={status}
                onStatusChange={setStatus}
                onSave={() => handleSave()}
                onDelete={handleDelete}
                onPreview={handlePreview}
                isSaving={saving}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <EditorSidebarLeft 
                    activeStatus={status}
                    onStatusSelect={setStatus}
                    posts={allPosts}
                    currentPostId={id}
                    onPostSelect={handleSidebarPostSelect}
                    onCreateNew={handleCreateNew}
                />

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm text-muted-foreground animate-pulse">Cargando contenido...</p>
                            </div>
                        </div>
                    ) : !id && !isCreating ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zinc-50/30 dark:bg-zinc-950/30">
                            <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 shadow-inner">
                                <FileEdit size={32} className="text-zinc-300" />
                            </div>
                            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">Administrador del Foro</h2>
                            <p className="text-zinc-500 max-w-md mb-8 text-sm leading-relaxed">
                                Selecciona una publicación de la izquierda para editarla, o crea una nueva para empezar a compartir conocimiento.
                            </p>
                            <Button 
                                onClick={handleCreateNew}
                                className="rounded-xl h-11 px-8 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-lg hover:shadow-zinc-900/10 dark:hover:shadow-white/10 transition-all active:scale-95"
                            >
                                <Plus size={18} className="mr-2" strokeWidth={3} />
                                Crear nueva publicación
                            </Button>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col p-4 md:p-8 lg:px-12 space-y-6 sm:space-y-8 min-h-0">
                            {/* Title Section */}
                            <div className="shrink-0">
                                <label className="text-sm font-bold tracking-tight text-zinc-900/80 dark:text-zinc-100/80 mb-2.5 block">
                                    Título
                                </label>
                                <input 
                                    type="text" 
                                    value={title} 
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl h-11 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-800 transition-all placeholder:text-zinc-400 font-sans shadow-sm"
                                    placeholder={status === 'published' ? "Ej: Protocolo de Atención" : "Título de la publicación"}
                                />
                            </div>

                            {/* Description Section */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <label className="text-sm font-bold tracking-tight text-zinc-900/80 dark:text-zinc-100/80 mb-2.5 block">
                                    Contenido
                                </label>
                                
                                <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-800 transition-all shadow-sm min-h-[300px]">
                                    <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                                        <TiptapToolbar editor={editor} />
                                    </div>

                                    <ScrollArea className="flex-1 h-full">
                                        <ScrollAreaViewport className="h-full">
                                            <div className="min-h-full p-6 sm:p-8 text-sm font-sans">
                                                <TiptapEditor 
                                                    key={id || 'new'}
                                                    initialContent={content} 
                                                    onChange={setContent}
                                                    onCreate={setEditor}
                                                />
                                            </div>
                                        </ScrollAreaViewport>
                                        <ScrollAreaScrollbar />
                                    </ScrollArea>
                                </div>
                            </div>

                            {/* Categories Section */}
                            <div className="shrink-0 pb-2">
                                <label className="text-sm font-bold tracking-tight text-zinc-900/80 dark:text-zinc-100/80 mb-2.5 block">
                                    Categorías
                                </label>
                            
                                <Combobox 
                                    value={selectedCategories} 
                                    onValueChange={setSelectedCategories}
                                    multiple
                                >
                                    <ComboboxChips 
                                        className="rounded-xl border-zinc-200 dark:border-zinc-800"
                                        startAddon={<SearchIcon className="text-zinc-400" size={16} />}
                                    >
                                        {selectedCategories.map((item) => (
                                            <ComboboxChip 
                                                key={item.value} 
                                                className="text-sm font-bold"
                                            >
                                                {item.label}
                                            </ComboboxChip>
                                        ))}
                                        <ComboboxChipsInput
                                            aria-label="Seleccionar categorías"
                                            className="text-sm font-bold placeholder:text-zinc-400"
                                            placeholder={selectedCategories.length > 0 ? undefined : "Seleccionar categorías..."}
                                        />
                                    </ComboboxChips>
                                    <ComboboxPopup className="rounded-xl border-zinc-200 dark:border-zinc-800 shadow-xl">
                                        <ComboboxEmpty className="text-sm font-medium">No se encontraron categorías.</ComboboxEmpty>
                                        <ComboboxList>
                                            {availableCategories.map((item) => (
                                                <ComboboxItem 
                                                    key={item.value} 
                                                    value={item}
                                                    className="text-sm font-bold py-2.5"
                                                >
                                                    {item.label}
                                                </ComboboxItem>
                                            ))}
                                        </ComboboxList>
                                    </ComboboxPopup>
                                </Combobox>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

