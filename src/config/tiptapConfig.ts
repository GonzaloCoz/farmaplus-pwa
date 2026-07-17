import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Youtube } from "@tiptap/extension-youtube";
import { Extension } from "@tiptap/core";

// Custom Font Size Extension
export const FontSize = Extension.create({
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
                        parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
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
                return (chain() as any).setMark('textStyle', { fontSize }).run();
            },
            unsetFontSize: () => ({ chain }) => {
                return (chain() as any).setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
            },
        } as any;
    },
});

// Custom Font Weight Extension
export const FontWeight = Extension.create({
    name: 'fontWeight',
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
                    fontWeight: {
                        default: null,
                        parseHTML: element => element.style.fontWeight,
                        renderHTML: attributes => {
                            if (!attributes.fontWeight) return {};
                            return { style: `font-weight: ${attributes.fontWeight}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontWeight: fontWeight => ({ chain }) => {
                return (chain() as any).setMark('textStyle', { fontWeight }).run();
            },
            unsetFontWeight: () => ({ chain }) => {
                return (chain() as any).setMark('textStyle', { fontWeight: null }).removeEmptyTextStyle().run();
            },
        } as any;
    },
});

export const getTiptapExtensions = () => {
    const extensions = [
        StarterKit.configure(),
        TextStyle.configure(),
        FontSize.configure(),
        FontWeight.configure(),
        Color.configure(),
        FontFamily.configure(),
        Underline.configure(),
        Youtube.configure({
            inline: false,
            width: 640,
            height: 480,
        }),
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
    ];

    // Filter out duplicates by name to prevent Tiptap warnings
    const seen = new Set();
    return extensions.filter(ext => {
        if (seen.has(ext.name)) return false;
        seen.add(ext.name);
        return true;
    });
};

export const TIPTAP_STYLES = `
    .ProseMirror { font-family: var(--font-sans); color: var(--foreground); }
    .ProseMirror h1 { font-family: 'Inter'; font-weight: 800; letter-spacing: -0.04em; font-size: 48px; margin-bottom: 0.5em; line-height: 1.1; color: var(--foreground); }
    .ProseMirror h2 { font-family: 'Inter'; font-weight: 800; letter-spacing: -0.02em; font-size: 32px; margin-top: 1.5em; margin-bottom: 0.8em; line-height: 1.2; color: var(--foreground); }
    .ProseMirror h3 { font-family: 'Inter'; font-weight: 800; letter-spacing: -0.01em; font-size: 24px; margin-top: 1.25em; margin-bottom: 0.6em; line-height: 1.3; color: var(--foreground); }
    .ProseMirror p { font-size: 18px; margin-bottom: 1.2em; opacity: 0.9; font-weight: 400; line-height: 1.6; }
    .ProseMirror img { margin: 2rem 0; border-radius: 1rem; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
    .ProseMirror blockquote { border-left: 4px solid #E2E8F0; padding-left: 1.5rem; font-style: italic; color: #64748B; }
    .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1.2em; }
    .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1.2em; }
    .ProseMirror li { margin-bottom: 0.5em; opacity: 0.85; font-weight: 400; font-size: 18px; }
`;
