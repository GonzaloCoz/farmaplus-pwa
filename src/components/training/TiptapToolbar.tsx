"use client";

import React, { useRef } from "react";
import { Bold01 as TextBold, Italic01 as TextItalic, Underline01 as TextUnderline, TypeStrikethrough01 as TextCross, Link01 as LinkIcon, AlignLeft, AlignCenter as AlignHorizontalCenter, AlignRight, Image01 as Gallery, VideoRecorder as Videocamera, FaceIdSquare as EmojiFunnySquare, ChevronDown as AltArrowDown, Type01 as Text } from '@untitledui/icons';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@/components/ui/popover";
import { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";

interface TiptapToolbarProps {
  editor: Editor | null;
  className?: string;
}

const headingItems = [
  { label: "Normal", value: "paragraph", style: { fontSize: '14px', fontWeight: 400 } },
  { label: "Título 1", value: "h1", style: { fontSize: '24px', fontWeight: 700, fontFamily: '"Inter"' } },
  { label: "Título 2", value: "h2", style: { fontSize: '20px', fontWeight: 700, fontFamily: '"Inter"' } },
  { label: "Título 3", value: "h3", style: { fontSize: '18px', fontWeight: 600, fontFamily: '"Inter"' } },
];

const fontFamilies = [
  { label: "Inter", value: "Inter" },
  { label: "Serif", value: "ui-serif" },
  { label: "Mono", value: "monospace" },
];

const fontSizes = [
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "32px", value: "32px" },
];

const fontWeightItems = [
  { label: "Light", value: "300" },
  { label: "Regular", value: "400" },
  { label: "Medium", value: "500" },
  { label: "SemiBold", value: "600" },
  { label: "Bold", value: "700" },
];

const COMMON_EMOJIS = ["❤️", "✨", "🔥", "✅", "🚀", "💡", "📦", "🎉", "⭐", "💎", "👋", "🙌", "👍", "👏", "💻", "📱"];

export function TiptapToolbar({ editor, className }: TiptapToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const handleHeadingChange = (value: string) => {
    if (value === "paragraph") {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value.replace('h', '')) as any;
      // Using setHeading instead of toggleHeading to ensure it transforms the current block
      editor.chain().focus().setHeading({ level }).run();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          editor.chain().focus().setImage({ src: result }).run();
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    event.target.value = "";
  };

  const currentHeading = editor.isActive('heading', { level: 1 }) ? 'h1' 
    : editor.isActive('heading', { level: 2 }) ? 'h2' 
    : editor.isActive('heading', { level: 3 }) ? 'h3' 
    : 'paragraph';

  const currentFont = editor.getAttributes('textStyle').fontFamily || '"Inter"';
  const currentWeight = editor.getAttributes('textStyle').fontWeight || "400";
  const currentSize = editor.getAttributes('textStyle').fontSize || "14px";

  const getStyleLabel = (value: string) => {
     const item = headingItems.find(i => i.value === value);
     return item ? item.label : "Estilo";
  };

  return (
    <Toolbar className={cn("bg-transparent border-none shadow-none h-auto p-0 flex-wrap gap-x-3 gap-y-2 pb-2", className)}>
      
      {/* Typography Groups */}
      <ToolbarGroup className="gap-1 shrink-0">
        {/* Style */}
        <Select value={currentHeading} onValueChange={handleHeadingChange}>
          <SelectTrigger className="h-8 px-3 rounded-lg text-xs font-medium gap-1.5 w-[110px] border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
            <span className="truncate">{currentHeading === 'paragraph' ? 'Estilo' : getStyleLabel(currentHeading)}</span>
            <AltArrowDown size={14} className="shrink-0 opacity-50" />
          </SelectTrigger>
          <SelectPopup className="min-w-[160px] rounded-xl shadow-lg p-1">
            {headingItems.map(({ label, value, style }, idx) => (
              <SelectItem key={value} value={value} index={idx} className="text-xs py-2 rounded-lg" style={style}>
                {label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {/* Font Family */}
        <Select value={currentFont} onValueChange={(val) => editor.chain().focus().setFontFamily(val).run()}>
          <SelectTrigger title="Fuente" className="h-8 w-10 p-0 rounded-lg justify-center border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
             <Text size={18} />
          </SelectTrigger>
          <SelectPopup className="min-w-[150px] rounded-xl shadow-lg p-1">
            {fontFamilies.map(({ label, value }, idx) => (
              <SelectItem key={value} value={value} index={idx} className="text-sm py-2 rounded-lg" style={{ fontFamily: value }}>
                {label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {/* Font Weight */}
        <Select value={currentWeight} onValueChange={(val) => (editor.chain().focus() as any).setFontWeight(val).run()}>
          <SelectTrigger title="Peso" className="h-8 px-3 rounded-lg text-xs font-medium gap-1.5 min-w-[90px] border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
             <span className="truncate">Peso</span>
             <AltArrowDown size={14} className="shrink-0 opacity-50" />
          </SelectTrigger>
          <SelectPopup className="min-w-[120px] rounded-xl shadow-lg p-1">
            {fontWeightItems.map(({ label, value }, idx) => (
              <SelectItem key={value} value={value} index={idx} className="text-xs py-2 rounded-lg" style={{ fontWeight: value }}>
                {label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {/* Font Size */}
        <Select value={currentSize} onValueChange={(val) => (editor.chain().focus() as any).setFontSize(val).run()}>
          <SelectTrigger title="Tamaño" className="h-8 px-3 rounded-lg text-xs font-medium gap-1.5 min-w-[95px] border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
             <span className="truncate">Tamaño</span>
             <AltArrowDown size={14} className="shrink-0 opacity-50" />
          </SelectTrigger>
          <SelectPopup className="min-w-[100px] rounded-xl shadow-sm">
            {fontSizes.map(({ label, value }, idx) => (
              <SelectItem key={value} value={value} index={idx} className="text-xs">{label}</SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </ToolbarGroup>

      <ToolbarSeparator className="h-6 mx-1 opacity-20 shrink-0" />

      {/* Formatting Group */}
      <ToolbarGroup className="gap-0.5 shrink-0">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive('bold') && "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100")}
        >
          <TextBold size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive('italic') && "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100")}
        >
          <TextItalic size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn("h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive('underline') && "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100")}
        >
          <TextUnderline size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn("h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive('strike') && "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100")}
        >
          <TextCross size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => {
            const url = window.prompt('URL', editor.getAttributes('link').href);
            if (url) editor.chain().focus().setLink({ href: url }).run();
            else if (url === '') editor.chain().focus().unsetLink().run();
          }}
          className={cn("h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive('link') && "bg-zinc-100 dark:bg-zinc-800 text-primary")}
        >
          <LinkIcon size={18} />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator className="h-6 mx-1 opacity-20 shrink-0" />

      {/* Alignment Group */}
      <ToolbarGroup className="gap-0.5 shrink-0">
        {[
          { icon: AlignLeft, value: 'left' },
          { icon: AlignHorizontalCenter, value: 'center' },
          { icon: AlignRight, value: 'right' },
        ].map((item) => (
          <ToolbarButton
            key={item.value}
            onClick={() => editor.chain().focus().setTextAlign(item.value).run()}
            className={cn("h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800", editor.isActive({ textAlign: item.value }) && "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100")}
          >
            <item.icon size={18} />
          </ToolbarButton>
        ))}
      </ToolbarGroup>

      <ToolbarSeparator className="h-6 mx-1 opacity-20 shrink-0" />

      {/* Media Group - Fixed on the same line */}
      <ToolbarGroup className="gap-0.5 shrink-0">
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange} 
        />
        <ToolbarButton
          title="Imagen Local"
          onClick={() => fileInputRef.current?.click()}
          className="h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
        >
          <Gallery size={18} />
        </ToolbarButton>

        <ToolbarButton
          title="Video (YouTube)"
          onClick={() => {
            const url = window.prompt('URL de YouTube');
            if (url) (editor.chain().focus() as any).setYoutubeVideo({ src: url }).run();
          }}
          className="h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
        >
          <Videocamera size={18} />
        </ToolbarButton>

        <Popover>
          <PopoverTrigger render={
            <ToolbarButton
              title="Emoji"
              className="h-8 w-8 p-0 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 flex items-center justify-center translate-y-[1px]"
            >
              <EmojiFunnySquare size={18} />
            </ToolbarButton>
          } />
          <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-4 gap-1">
               {COMMON_EMOJIS.map(emoji => (
                 <button 
                  key={emoji}
                  onClick={() => {
                    editor.chain().focus().insertContent(emoji).run();
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-lg"
                 >
                   {emoji}
                 </button>
               ))}
            </div>
          </PopoverContent>
        </Popover>
      </ToolbarGroup>

    </Toolbar>
  );
}

