import React, { useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";

// Custom Font Size Extension
const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return {
            types: ['textStyle'],
        };
    },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
                        renderHTML: attributes => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: fontSize => ({ chain }) => {
                return chain().setMark('textStyle', { fontSize }).run();
            },
            unsetFontSize: () => ({ chain }) => {
                return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
            },
        };
    },
});

interface TiptapEditorProps {
    initialContent?: any;
    onChange: (content: any) => void;
    onCreate?: (editor: any) => void;
    fontSize?: number;
    spacing?: number;
    alignment?: string;
}

// Static Extensions outside component to avoid re-renders and duplicates
// We manually add only what's missing from StarterKit or needs custom config
const STATIC_EXTENSIONS = [
    StarterKit.configure({
        // Standard StarterKit configuration
    }),
    TextStyle,
    FontSize,
    Color,
    FontFamily,
    Underline,
    Image.configure({
        HTMLAttributes: {
            class: 'rounded-2xl max-w-full h-auto shadow-lg my-8',
        },
    }),
    Link.configure({
        openOnClick: false,
        HTMLAttributes: {
            class: 'text-primary underline font-bold',
        },
    }),
    TextAlign.configure({
        types: ['heading', 'paragraph'],
    }),
    Placeholder.configure({
        placeholder: 'Escribe algo increíble...',
    }),
];

export function TiptapEditor({ 
    initialContent, 
    onChange,
    onCreate,
    fontSize,
    spacing,
    alignment
}: TiptapEditorProps) {
    const editor = useEditor({
        extensions: STATIC_EXTENSIONS,
        content: initialContent || '',
        onUpdate: ({ editor }) => {
            onChange(editor.getJSON());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[400px]',
            },
        },
    });

    // Notify creation safely
    useEffect(() => {
        if (editor && onCreate) {
            onCreate(editor);
        }
    }, [editor]);

    // Sync Editor with external controls
    useEffect(() => {
        if (!editor) return;
        
        editor.setOptions({
            editorProps: {
                attributes: {
                    style: `font-size: ${fontSize}px; line-height: ${spacing};`,
                    class: 'prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[400px]',
                }
            }
        });
    }, [fontSize, spacing, editor]);

    if (!editor) return null;

    return (
        <div className="relative group w-full">
            <EditorContent editor={editor} />
            
            <style dangerouslySetInnerHTML={{ __html: `
                .ProseMirror {
                    transition: all 0.3s ease;
                    min-height: 800px;
                }
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #adb5bd;
                    pointer-events: none;
                    height: 0;
                    font-weight: 400;
                }
                .ProseMirror h1 { font-weight: 900; letter-spacing: -0.05em; font-size: 3em; margin-bottom: 0.5em; line-height: 1.1; }
                .ProseMirror h2 { font-weight: 800; letter-spacing: -0.03em; font-size: 2em; margin-top: 2em; margin-bottom: 0.8em; line-height: 1.2; }
                .ProseMirror p { margin-bottom: 1.2em; opacity: 0.85; font-weight: 500; }
                .ProseMirror img { margin: 2rem 0; border-radius: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.1); }
                .ProseMirror blockquote { border-left: 4px solid #E2E8F0; padding-left: 1.5rem; font-style: italic; color: #64748B; }
            `}} />
        </div>
    );
}
