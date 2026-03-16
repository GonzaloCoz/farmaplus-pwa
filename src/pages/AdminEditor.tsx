
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { TiptapEditor } from "../components/training/TiptapEditor";
import { EditorSidebarRight } from "../components/training/EditorSidebarRight";
import { AltArrowLeft as ArrowLeft, Diskette as Save, Play as Publish, Eye as Preview } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trainingService, TrainingPost } from "../services/trainingService";
import { notify } from "@/lib/notifications";

import { TrainingFab } from "../components/training/TrainingFab";
import { supabase } from "@/integrations/supabase/client";

export default function AdminEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // Editor State
    const [title, setTitle] = useState("Nueva Publicación");
    const [content, setContent] = useState<any>(null);
    const [loading, setLoading] = useState(!!id);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('mis-notas');
    const [editor, setEditor] = useState<any>(null);

    // Style State (Pixel-perfect requirements)
    const [theme, setTheme] = useState({
        id: 'normal',
        bg: 'white',
        text: 'zinc-900',
    });
    const [font, setFont] = useState('Inter');
    const [fontSize, setFontSize] = useState(16);
    const [spacing, setSpacing] = useState(1.6);
    const [alignment, setAlignment] = useState<'left' | 'center' | 'right' | 'justify'>('left');

    const loadGoogleFont = (fontFamily: string) => {
        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;700;900&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    };

    useEffect(() => {
        loadGoogleFont(font);
    }, [font]);

    useEffect(() => {
        if (id) loadPost();
    }, [id]);

    const loadPost = async () => {
        try {
            const post = await trainingService.getPostById(id!);
            setTitle(post.title || "Sin Título");
            setContent(post.content);
        } catch (error) {
            notify.error("Error", "No se pudo cargar la publicación.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (status: 'draft' | 'published' = 'draft') => {
        if (!title.trim()) {
            notify.error("Error", "La publicación debe tener un título.");
            return;
        }

        setSaving(true);
        try {
            // Diagnostic: Check Auth first
            const { data: { user: authUser } } = await supabase.auth.getUser();
            console.log("AdminEditor: Auth user check:", authUser?.id || "NO USER");
            
            if (!authUser) {
                notify.error("No autenticado", "No tienes una sesión de Supabase activa. Por favor, cierra sesión y vuelve a entrar.");
                setSaving(false);
                return;
            }

            const postData: Partial<TrainingPost> = {
                title,
                content,
                status,
            };
            
            if (id) {
                await trainingService.updatePost(id, postData);
            } else {
                const newPost = await trainingService.createPost(postData);
                if (newPost?.id) {
                    navigate(`/foro/admin/edit/${newPost.id}`, { replace: true });
                }
            }
            notify.success("Éxito", `Publicación guardada como ${status === 'published' ? 'publicada' : 'borrador'}.`);
        } catch (error: any) {
            console.error("HandleSave Error:", error);
            const msg = error.message || "No se pudo guardar la publicación.";
            notify.error("Error", msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!id) {
            navigate('/foro');
            return;
        }

        if (!confirm("¿Estás seguro de que deseas eliminar esta publicación?")) return;

        setSaving(true);
        try {
            await trainingService.deletePost(id);
            notify.success("Eliminado", "La publicación ha sido eliminada.");
            navigate('/foro');
        } catch (error) {
            notify.error("Error", "No se pudo eliminar la publicación.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#F5F5F5] dark:bg-zinc-950 overflow-hidden font-sans relative">
            {/* Left Sidebar */}
            <div className="w-[180px] border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col py-6 px-4">
                <div className="flex items-center gap-2 mb-8 px-2">
                    <button 
                        onClick={() => navigate('/foro')}
                        className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h2 className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">Editor de Notas</h2>
                </div>
                
                <nav className="space-y-0.5">
                    {[
                        { id: 'mis-notas', label: 'Mis Notas' },
                        { id: 'notas-compartidas', label: 'Notas Compartidas' },
                        { id: 'papelera', label: 'Papelera' },
                    ].map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all duration-200",
                                activeTab === item.id 
                                    ? "bg-zinc-900 dark:bg-zinc-200 text-white dark:text-zinc-900 font-semibold" 
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 font-normal"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Editor Canvas */}
            <div className="flex-1 overflow-y-auto flex justify-center items-start py-10 px-6 no-scrollbar">
                <div 
                    className={cn(
                        "w-full max-w-[680px] min-h-[800px] shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] rounded-[2rem] p-10 md:p-14 transition-all duration-300 flex flex-col mb-20",
                        theme.id === 'normal' && "bg-white text-zinc-900",
                        theme.id === 'blue' && "bg-[#EFF6FF] text-[#1E40AF]",
                        theme.id === 'green' && "bg-[#F0FDF4] text-[#166534]",
                        theme.id === 'yellow' && "bg-[#FEFCE8] text-[#854D0E]",
                        theme.id === 'custom' && "bg-[#FAF5EF] text-[#44403C]"
                    )}
                    style={{ 
                        fontFamily: font,
                        fontSize: `${fontSize}px`,
                        lineHeight: spacing
                    }}
                >
                    <input 
                        type="text" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-2xl md:text-3xl font-bold mb-6 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 tracking-tight"
                        placeholder="El Nuevo Comienzo.."
                    />

                    <TiptapEditor 
                        initialContent={content} 
                        onChange={setContent}
                        onCreate={setEditor}
                        fontSize={fontSize}
                        spacing={spacing}
                        alignment={alignment}
                    />
                </div>
            </div>

            {/* Right Sidebar */}
            <EditorSidebarRight 
                theme={theme}
                setTheme={setTheme}
                font={font}
                setFont={setFont}
                fontSize={fontSize}
                setFontSize={setFontSize}
                spacing={spacing}
                setSpacing={setSpacing}
                alignment={alignment}
                setAlignment={setAlignment}
                onSave={() => handleSave('draft')}
                onPublish={() => handleSave('published')}
                editor={editor}
            />

            {/* Floating Action Button */}
            <TrainingFab 
                onPublish={() => handleSave('published')}
                onSaveDraft={() => handleSave('draft')}
                onDelete={handleDelete}
                isSaving={saving}
            />
        </div>
    );
}
