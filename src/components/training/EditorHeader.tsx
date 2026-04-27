import React from "react";
import { 
  ArrowLeft, 
  ExternalLink, 
  Link as LinkIcon, 
  Trash2, 
  Save,
  ArrowRight as ArrowRightIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface EditorHeaderProps {
  title: string;
  onSave: () => void;
  onDelete: () => void;
  onPreview: () => void;
  isSaving: boolean;
  status: 'draft' | 'published' | 'archived';
  onStatusChange: (status: 'draft' | 'published' | 'archived') => void;
}

export function EditorHeader({
  title,
  onSave,
  onDelete,
  onPreview,
  isSaving,
  status,
  onStatusChange
}: EditorHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80  flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/foro')}
          className="rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-bold tracking-tight text-foreground line-clamp-1 max-w-[300px]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Status Switch */}
        <div className="flex items-center gap-2 mr-4 px-3 py-1.5 rounded-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
          <Label htmlFor="status-toggle" className="text-xs font-semibold text-zinc-500 tracking-wider">
            {status === 'published' ? 'Publicado' : 'Oculto'}
          </Label>
          <Switch 
            id="status-toggle"
            checked={status === 'published'}
            onCheckedChange={(checked) => onStatusChange(checked ? 'published' : 'draft')}
            className="scale-90"
          />
        </div>

        <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-800 pr-2 mr-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onPreview}
            className="rounded-lg h-9 w-9 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-lg h-9 w-9 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onDelete}
            className="rounded-lg h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <Button 
          onClick={onSave}
          disabled={isSaving}
          loading={isSaving}
          className="rounded-lg h-9 px-5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-sm shadow-sm transition-all active:scale-95"
        >
          {status === 'published' ? 'Guardar' : 'Publicar'}
          <ArrowRightIcon
            aria-hidden="true"
            className="ml-1 -mr-1 h-4 w-4 in-[[data-slot=button]:hover]:translate-x-0.5 transition-transform"
          />
        </Button>
      </div>
    </header>
  );
}

