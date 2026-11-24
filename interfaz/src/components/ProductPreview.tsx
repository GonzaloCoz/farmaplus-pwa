import { useState, useCallback } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { RefreshCw01 as Loader2, Image01 as ImageOff, SearchLg as SearchIcon } from '@untitledui/icons';

interface ProductPreviewProps {
    ean: string;
    productName: string;
    className?: string;
}

function getImageUrl(productName: string, size: number = 300): string {
    const query = encodeURIComponent(productName);
    return `https://tse2.mm.bing.net/th?q=${query}&w=${size}&h=${size}&c=7&rs=1&p=0`;
}

export function ProductPreview({ ean, productName, className }: ProductPreviewProps) {
    const [thumbnailError, setThumbnailError] = useState(false);
    const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
    const [fullImageError, setFullImageError] = useState(false);
    const [fullImageLoaded, setFullImageLoaded] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const isUnknown = (productName || '').startsWith('Producto ');

    const thumbnailUrl = getImageUrl(productName, 120);
    const fullUrl = getImageUrl(productName, 500);

    const handleOpen = useCallback((open: boolean) => {
        setIsOpen(open);
        if (open && !fullImageLoaded) {
            setFullImageError(false);
        }
    }, [fullImageLoaded]);

    return (
        <Popover open={isOpen} onOpenChange={handleOpen}>
            <PopoverTrigger
                render={
                    <button
                        className={cn(
                            "w-10 h-10 rounded-xl border border-border/50 bg-muted/30 flex-shrink-0 overflow-hidden",
                            "flex items-center justify-center cursor-pointer",
                            "transition-all duration-200 hover:border-primary/40 hover:shadow-sm hover:scale-105",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
                            isUnknown && "border-destructive/30 bg-destructive/5",
                            className
                        )}
                    >
                        {isUnknown ? (
                            <ImageOff className="w-4 h-4 text-destructive/40" />
                        ) : thumbnailError ? (
                            <ImageOff className="w-4 h-4 text-muted-foreground/30" />
                        ) : (
                            <>
                                {!thumbnailLoaded && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                                    </div>
                                )}
                                <img
                                    src={thumbnailUrl}
                                    alt=""
                                    loading="lazy"
                                    className={cn(
                                        "w-full h-full object-cover transition-opacity duration-300",
                                        thumbnailLoaded ? "opacity-100" : "opacity-0"
                                    )}
                                    onLoad={() => setThumbnailLoaded(true)}
                                    onError={() => setThumbnailError(true)}
                                />
                            </>
                        )}
                    </button>
                }
            />
            <PopoverContent
                className="w-72 p-0 overflow-hidden rounded-lg border border-border/40 bg-background  shadow-md"
                align="start"
                sideOffset={8}
            >
                {/* Image area */}
                <div className="relative aspect-square bg-muted/20 flex items-center justify-center overflow-hidden">
                    {isUnknown ? (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground/50 p-6 text-center">
                            <ImageOff className="w-12 h-12" />
                            <p className="text-xs font-medium">Producto no encontrado en la base de datos</p>
                        </div>
                    ) : fullImageError ? (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground/50 p-6 text-center">
                            <ImageOff className="w-12 h-12" />
                            <p className="text-xs font-medium">No se pudo cargar la imagen</p>
                        </div>
                    ) : (
                        <>
                            {!fullImageLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/10">
                                    <Loader2 className="w-6 h-6 text-primary/40 animate-spin" />
                                </div>
                            )}
                            <img
                                src={fullUrl}
                                alt={productName}
                                className={cn(
                                    "w-full h-full object-contain p-3 transition-opacity duration-300",
                                    fullImageLoaded ? "opacity-100" : "opacity-0"
                                )}
                                onLoad={() => setFullImageLoaded(true)}
                                onError={() => setFullImageError(true)}
                            />
                        </>
                    )}
                </div>

                {/* Info footer */}
                <div className="p-3.5 border-t border-border/30 space-y-1.5">
                    <p className="text-[13px] font-semibold text-foreground/90 leading-tight line-clamp-2">
                        {productName}
                    </p>
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-muted-foreground/70 tracking-wider">
                            {ean}
                        </span>
                        <span className="text-[9px] font-medium text-muted-foreground/40 flex items-center gap-1">
                            <SearchIcon className="w-2.5 h-2.5" />
                            Bing Images
                        </span>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

