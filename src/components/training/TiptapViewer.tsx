import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { getTiptapExtensions, TIPTAP_STYLES } from "@/config/tiptapConfig";

interface TiptapViewerProps {
    content: any;
    className?: string;
}

export function TiptapViewer({ content, className = "" }: TiptapViewerProps) {
    const extensions = React.useMemo(() => getTiptapExtensions(), []);
    
    const editor = useEditor({
        extensions,
        content: content || '',
        editable: false,
        editorProps: {
            attributes: {
                class: `prose prose-zinc dark:prose-invert max-w-none focus:outline-none ${className}`,
            },
        },
    });

    React.useEffect(() => {
        if (editor && content && editor.isEmpty) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) return null;

    return (
        <div className="w-full">
            <EditorContent editor={editor} />
            <style dangerouslySetInnerHTML={{ __html: TIPTAP_STYLES }} />
        </div>
    );
}

export default TiptapViewer;
