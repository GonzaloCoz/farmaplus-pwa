import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Loader2, ImageOff } from "lucide-react";

interface ProductImageHoverProps {
    ean: string;
    name: string;
    children: React.ReactNode;
}

export function ProductImageHover({ ean, name, children }: ProductImageHoverProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isOpen && !imageUrl) {
            // Construct Bing Thumbnail URL
            // This is an unofficial endpoint often used for prototypes.
            // In a production environment, you should use the official Bing Search API or Google Custom Search API with an API Key.
            const query = encodeURIComponent(name);
            const url = `https://tse2.mm.bing.net/th?q=${query}&w=300&h=300&c=7&rs=1&p=0`;
            setImageUrl(url);
        }
    }, [isOpen, name]);

    return (
        <HoverCard open={isOpen} onOpenChange={setIsOpen}>
            <HoverCardTrigger asChild>
                <div className="cursor-help decoration-dotted underline-offset-4 w-fit max-w-full">
                    {children}
                </div>
            </HoverCardTrigger>
            <HoverCardContent
                className="w-64 p-0 overflow-hidden bg-white border-none shadow-xl"
                side="right"
                align="center"
                sideOffset={10}
                avoidCollisions={false}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-full h-full"
                >
                    <div className="relative aspect-square flex items-center justify-center bg-gray-50">
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={name}
                                className="w-full h-full object-contain p-2"
                                onError={() => setError(true)}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="text-xs">Cargando...</span>
                            </div>
                        )}
                        {error && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-muted-foreground p-4 text-center">
                                <ImageOff className="h-8 w-8 opacity-50" />
                                <span className="text-xs">
                                    No se pudo cargar la imagen
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="p-3 border-t bg-gray-50/50">
                        <p className="text-xs font-medium truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground">
                            Búsqueda por nombre (Bing)
                        </p>
                    </div>
                </motion.div>
            </HoverCardContent>
        </HoverCard>
    );
}
