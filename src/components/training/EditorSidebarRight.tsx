import React, { useState, useRef } from "react";
import { 
    CheckRead as Check, 
    Gallery as ImageIcon,
    Link as LinkIcon,
    List as ListIcon,
} from "@solar-icons/react";
import { 
    Bold, 
    Italic, 
    Underline, 
    Strikethrough as Strike, 
    AlignLeft, 
    AlignCenter, 
    AlignRight, 
    AlignJustify,
    Smile
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface EditorSidebarRightProps {
    theme: any;
    setTheme: (t: any) => void;
    font: string;
    setFont: (f: string) => void;
    fontSize: number;
    setFontSize: (s: number) => void;
    spacing: number;
    setSpacing: (s: number) => void;
    alignment: string;
    setAlignment: (a: any) => void;
    onSave: () => void;
    onPublish: () => void;
    editor?: any;
}

const EMOJIS = ['😀','😂','🤩','👍','❤️','🔥','✨','🎉','💡','✅','⚡','🚀','📌','🎯','💪','👏','🙌','😎','🤔','📝'];

export function EditorSidebarRight({
    theme, setTheme,
    font, setFont,
    fontSize, setFontSize,
    spacing, setSpacing,
    alignment, setAlignment,
    onSave, onPublish,
    editor
}: EditorSidebarRightProps) {

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const themes = [
        { id: 'normal', bg: 'bg-white', text: 'text-zinc-900', label: 'Aa' },
        { id: 'blue', bg: 'bg-[#D6EAFF]', text: 'text-[#1D4ED8]', label: 'Aa' },
        { id: 'green', bg: 'bg-[#DCFCE7]', text: 'text-[#166534]', label: 'Aa' },
        { id: 'yellow', bg: 'bg-[#FEF9C3]', text: 'text-[#854D0E]', label: 'Aa' },
        { id: 'custom', bg: 'bg-[#F5F0E8]', text: 'text-[#78716C]', label: 'Aa' },
    ];

    const isActive = (type: string) => {
        if (!editor) return false;
        return editor.isActive(type);
    };

    const toggle = (type: string) => {
        if (!editor) return;
        switch(type) {
            case 'bold': editor.chain().focus().toggleBold().run(); break;
            case 'italic': editor.chain().focus().toggleItalic().run(); break;
            case 'underline': editor.chain().focus().toggleUnderline().run(); break;
            case 'strike': editor.chain().focus().toggleStrike().run(); break;
        }
    };

    const cycleAlignment = () => {
        if (!editor) return;
        const aligns: ('left' | 'center' | 'right' | 'justify')[] = ['left', 'center', 'right', 'justify'];
        const idx = aligns.indexOf(alignment as any);
        const next = aligns[(idx + 1) % aligns.length];
        editor.chain().focus().setTextAlign(next).run();
        setAlignment(next);
    };

    // ── Image Insertion ──
    const handleImageUpload = () => {
        fileInputRef.current?.click();
    };

    const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editor) return;
        const reader = new FileReader();
        reader.onload = () => {
            const url = reader.result as string;
            editor.chain().focus().setImage({ src: url }).run();
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // ── Link Insertion ──
    const handleInsertLink = () => {
        if (!editor) return;
        if (showLinkInput) {
            // Apply the link
            if (linkUrl) {
                const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            }
            setShowLinkInput(false);
            setLinkUrl('');
        } else {
            // Check if there's already a link
            const existingLink = editor.getAttributes('link').href;
            if (existingLink) {
                editor.chain().focus().unsetLink().run();
            } else {
                setShowLinkInput(true);
            }
        }
    };

    // ── Bullets ──
    const handleToggleBullets = () => {
        if (!editor) return;
        editor.chain().focus().toggleBulletList().run();
    };

    // ── Emoji ──
    const handleInsertEmoji = (emoji: string) => {
        if (!editor) return;
        editor.chain().focus().insertContent(emoji).run();
        setShowEmojiPicker(false);
    };

    const AlignIcon = alignment === 'center' ? AlignCenter 
        : alignment === 'right' ? AlignRight 
        : alignment === 'justify' ? AlignJustify 
        : AlignLeft;

    return (
        <div className="w-[280px] border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col py-5 px-4 overflow-y-auto">
            
            {/* Hidden file input for images */}
            <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={onFileSelected} 
            />

            {/* ── Estilo de Tema ── */}
            <div className="mb-1">
                <h3 className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">Estilo de Tema</h3>
                <div className="flex items-center gap-2">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTheme(t)}
                            className={cn(
                                "relative w-[42px] h-[42px] rounded-xl flex items-center justify-center text-[13px] font-bold transition-all duration-200 border",
                                t.bg, t.text,
                                theme.id === t.id 
                                    ? "border-zinc-300 dark:border-zinc-600 shadow-sm scale-105" 
                                    : "border-transparent hover:scale-105 hover:shadow-sm"
                            )}
                        >
                            {t.label}
                            {theme.id === t.id && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-700 dark:bg-zinc-300 rounded-full flex items-center justify-center">
                                    <Check size={10} className="text-white dark:text-zinc-900" weight="Bold" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 my-4" />

            {/* ── Editor de Texto ── */}
            <div className="mb-1">
                <h3 className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">Editor de Texto</h3>
                
                {/* Unified grid: Left col (Aa + B/I/U) | Right col (Strike/Align + Sliders) */}
                <div className="flex gap-1.5 min-h-[240px]">
                    {/* ── Left Section ── */}
                    <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                        {/* Aa Font Preview + Selector (grows to fill) */}
                        <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-3 flex flex-col justify-between flex-1">
                            <span className="text-4xl font-black text-zinc-800 dark:text-zinc-200 opacity-60 leading-none">Aa</span>
                            <div className="mt-auto">
                                <label className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Personalizar fuente</label>
                                <Select value={font} onValueChange={setFont}>
                                    <SelectTrigger className="h-8 border-none bg-white dark:bg-zinc-800 rounded-lg text-[11px] font-semibold px-3 shadow-sm">
                                        <SelectValue>Seleccionar</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="Inter" className="text-sm">Inter</SelectItem>
                                        <SelectItem value="Outfit" className="text-sm">Outfit</SelectItem>
                                        <SelectItem value="Roboto" className="text-sm">Roboto</SelectItem>
                                        <SelectItem value="Playfair Display" className="text-sm">Playfair</SelectItem>
                                        <SelectItem value="Montserrat" className="text-sm">Montserrat</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* B / I / U row */}
                        <div className="flex gap-1.5">
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <button
                                    onClick={() => toggle('bold')}
                                    className={cn(
                                        "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200",
                                        isActive('bold')
                                            ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    <Bold size={15} strokeWidth={2.5} />
                                </button>
                                <span className="text-[7px] font-semibold text-zinc-400">Negrita</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <button
                                    onClick={() => toggle('italic')}
                                    className={cn(
                                        "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200",
                                        isActive('italic')
                                            ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    <Italic size={15} strokeWidth={2.5} />
                                </button>
                                <span className="text-[7px] font-semibold text-zinc-400">Cursiva</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <button
                                    onClick={() => toggle('underline')}
                                    className={cn(
                                        "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200",
                                        isActive('underline')
                                            ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    <Underline size={15} strokeWidth={2.5} />
                                </button>
                                <span className="text-[7px] font-semibold text-zinc-400">Subrayar</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Right Section ── */}
                    <div className="flex flex-col gap-1.5 w-[95px]">
                        {/* Strike + Alignment row */}
                        <div className="flex gap-1.5">
                            <div className="flex flex-col items-center gap-0.5 flex-1">
                                <button 
                                    onClick={() => toggle('strike')}
                                    className={cn(
                                        "w-full h-[44px] rounded-xl flex items-center justify-center transition-all duration-200",
                                        isActive('strike') 
                                            ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900" 
                                            : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    <Strike size={16} strokeWidth={2} />
                                </button>
                                <span className="text-[7px] font-semibold uppercase text-zinc-400">Tachado</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5 flex-1">
                                <button 
                                    onClick={cycleAlignment}
                                    className="w-full h-[44px] rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-200"
                                >
                                    <AlignIcon size={16} strokeWidth={2} />
                                </button>
                                <span className="text-[7px] font-semibold uppercase text-zinc-400">Alinear</span>
                            </div>
                        </div>

                        {/* Size + Spacing vertical sliders (grow to fill remaining height) */}
                        <div className="flex gap-1.5 flex-1">
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <div className="w-full flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center py-3">
                                    <Slider
                                        orientation="vertical"
                                        min={12} max={32} step={1}
                                        value={[fontSize]}
                                        onValueChange={(v) => setFontSize(v[0])}
                                        className="h-full"
                                    />
                                </div>
                                <span className="text-[7px] font-semibold text-zinc-400">Tamaño</span>
                            </div>
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <div className="w-full flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center py-3">
                                    <Slider
                                        orientation="vertical"
                                        min={1} max={3} step={0.1}
                                        value={[spacing]}
                                        onValueChange={(v) => setSpacing(v[0])}
                                        className="h-full"
                                    />
                                </div>
                                <span className="text-[7px] font-semibold text-zinc-400">Espaciado</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 my-4" />

            {/* ── Otros ── */}
            <div className="relative">
                <h3 className="text-[11px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">Otros</h3>
                <div className="grid grid-cols-4 gap-1.5">
                    {/* Imagen */}
                    <div className="flex flex-col items-center gap-1">
                        <button 
                            onClick={handleImageUpload}
                            className="w-full aspect-square rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all duration-200"
                        >
                            <ImageIcon size={18} />
                        </button>
                        <span className="text-[7px] font-semibold text-zinc-400">Imagen</span>
                    </div>

                    {/* Enlace */}
                    <div className="flex flex-col items-center gap-1">
                        <button 
                            onClick={handleInsertLink}
                            className={cn(
                                "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200",
                                isActive('link')
                                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                            )}
                        >
                            <LinkIcon size={18} />
                        </button>
                        <span className="text-[7px] font-semibold text-zinc-400">Enlace</span>
                    </div>

                    {/* Viñetas */}
                    <div className="flex flex-col items-center gap-1">
                        <button 
                            onClick={handleToggleBullets}
                            className={cn(
                                "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200",
                                isActive('bulletList')
                                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                            )}
                        >
                            <ListIcon size={18} />
                        </button>
                        <span className="text-[7px] font-semibold text-zinc-400">Viñetas</span>
                    </div>

                    {/* Emoji */}
                    <div className="flex flex-col items-center gap-1 relative">
                        <button 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={cn(
                                "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-200",
                                showEmojiPicker
                                    ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                            )}
                        >
                            <Smile size={18} />
                        </button>
                        <span className="text-[7px] font-semibold text-zinc-400">Emoji</span>
                    </div>
                </div>

                {/* Link URL input */}
                {showLinkInput && (
                    <div className="mt-3 flex gap-1.5">
                        <input
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://ejemplo.com"
                            className="flex-1 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border-none px-2 text-[11px] font-medium placeholder:text-zinc-400 outline-none focus:ring-1 focus:ring-zinc-300"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleInsertLink(); }}
                            autoFocus
                        />
                        <button 
                            onClick={handleInsertLink}
                            className="h-8 px-3 rounded-lg bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900 text-[10px] font-bold hover:opacity-80 transition-opacity"
                        >
                            OK
                        </button>
                        <button 
                            onClick={() => { setShowLinkInput(false); setLinkUrl(''); }}
                            className="h-8 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-500 text-[10px] font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Emoji picker popup */}
                {showEmojiPicker && (
                    <div className="mt-2 p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg grid grid-cols-5 gap-1">
                        {EMOJIS.map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => handleInsertEmoji(emoji)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-base"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
