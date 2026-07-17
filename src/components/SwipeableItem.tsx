import { motion, PanInfo, useAnimation } from 'framer-motion';
import { Trash01 as Trash2 } from '@untitledui/icons';
import { ReactNode, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SwipeableItemProps {
  children: ReactNode;
  onDelete: () => void;
}

export function SwipeableItem({ children, onDelete }: SwipeableItemProps) {
  const controls = useAnimation();
  const [isRevealed, setIsRevealed] = useState(false);
  const dragThreshold = 50;
  const revealWidth = 70;
  
  // Ref to track if we are currently dragging to prevent click triggers
  const isDragging = useRef(false);

  const handleDragEnd = (_: any, info: PanInfo) => {
    isDragging.current = false;
    const offset = info.offset.x;

    if (offset < -dragThreshold) {
      // Swipe left to reveal delete on the right
      setIsRevealed(true);
      controls.start({ x: -revealWidth });
    } else if (offset > dragThreshold) {
      // Swipe right to close
      setIsRevealed(false);
      controls.start({ x: 0 });
    } else {
      // Snap to current state
      controls.start({ x: isRevealed ? -revealWidth : 0 });
    }
  };

  const handleDragStart = () => {
    isDragging.current = true;
  };

  return (
    <div className="relative overflow-hidden w-full group">
      {/* Background Action - Reveal on the right */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 w-[70px] flex items-center justify-center transition-opacity duration-200",
          isRevealed ? "opacity-100" : "opacity-0"
        )}
      >
        <Button
          variant="destructive"
          className="h-full w-full rounded-none flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          {/* Animated Delete Icon inspired by p-button-39 logic but for Trash */}
          <div className="relative size-6 flex items-center justify-center">
             <Trash2 className={cn("size-5 transition-all duration-300", isRevealed ? "scale-110 rotate-12" : "scale-100")} />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider">Borrar</span>
        </Button>
      </div>

      {/* Main Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -revealWidth, right: 0 }}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        initial={{ x: 0 }}
        className="relative z-10 bg-background w-full cursor-grab active:cursor-grabbing border-b border-border/40"
      >
        {children}
      </motion.div>
    </div>
  );
}
