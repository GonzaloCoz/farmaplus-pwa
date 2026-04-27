import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { getTiptapExtensions, TIPTAP_STYLES } from "@/config/tiptapConfig";

interface TiptapEditorProps {
    initialContent?: any;
    onChange: (content: any) => void;
    onCreate?: (editor: any) => void;
    fontSize?: number;
    spacing?: number;
    alignment?: string;
}

// Editor-specific extensions that we don't need in viewer
const getEditorExtensions = () => [
    ...getTiptapExtensions(),
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
    const extensions = React.useMemo(() => getEditorExtensions(), []);

    const editor = useEditor({
        extensions,
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
    }, [editor, onCreate]);

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

    // Update content when initialContent changes (e.g. after async load)
    useEffect(() => {
        if (editor && initialContent && editor.isEmpty) {
            editor.commands.setContent(initialContent);
        }
    }, [initialContent, editor]);

    if (!editor) return null;

    return (
        <div className="relative group w-full">
            <EditorContent editor={editor} />
            
            <style dangerouslySetInnerHTML={{ __html: `
                ${TIPTAP_STYLES}
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
            `}} />
        </div>
    );
}

export default TiptapEditor;
