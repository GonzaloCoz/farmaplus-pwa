import { useState, useEffect } from 'react';
import { Frame, FrameHeader, FrameTitle, FrameDescription, FramePanel } from '@/components/ui/frame';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrashBinMinimalistic as Trash, AddSquare as Add, Diskette as Save, Clipboard as Paste, InfoCircle as Info } from "@solar-icons/react";
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LaboratoryGridEditorProps {
    branchName: string;
    onSave: (data: { category: string; labs: string[] }[]) => Promise<void>;
    isSaving?: boolean;
}

const CATEGORIES = ["MEDICAMENTOS", "PERFUMERIA", "ACCESORIOS", "VARIOS"];

export function LaboratoryGridEditor({ branchName, onSave, isSaving }: LaboratoryGridEditorProps) {
    const [grid, setGrid] = useState<string[][]>([["", "", "", ""]]); // rows of [med, perf, acc, var]
    const [criticalLabs, setCriticalLabs] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);

    // Load initial data
    useEffect(() => {
        if (!branchName) return;

        const loadData = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('branch_laboratories')
                    .select('laboratory, category, progress_percentage')
                    .eq('branch_name', branchName);

                if (error) throw error;

                // Organize by category
                const catMap: Record<string, string[]> = {
                    "MEDICAMENTOS": [],
                    "PERFUMERIA": [],
                    "ACCESORIOS": [],
                    "VARIOS": []
                };

                const critical = new Set<string>();
                data?.forEach(item => {
                    const cat = item.category?.toUpperCase() || 'VARIOS';
                    if (catMap[cat]) {
                        catMap[cat].push(item.laboratory);
                    }
                    if (item.progress_percentage > 0) {
                        critical.add(`${item.laboratory.toUpperCase()}|${cat}`);
                    }
                });

                // Convert to grid
                const maxRows = Math.max(...Object.values(catMap).map(l => l.length), 1);
                const newGrid: string[][] = [];
                for (let i = 0; i < maxRows; i++) {
                    newGrid.push(CATEGORIES.map(cat => catMap[cat][i] || ""));
                }
                setGrid(newGrid);
                setCriticalLabs(critical);
            } catch (err) {
                console.error("Error loading labs:", err);
                notify.error("Error", "No se pudieron cargar los laboratorios.");
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [branchName]);

    const handleCellChange = (row: number, col: number, value: string) => {
        const newGrid = [...grid];
        newGrid[row][col] = value.toUpperCase();
        setGrid(newGrid);
    };

    const addRow = () => {
        setGrid([...grid, ["", "", "", ""]]);
    };

    const removeRow = (index: number) => {
        if (grid.length === 1) {
            setGrid([["", "", "", ""]]);
            return;
        }
        const newGrid = grid.filter((_, i) => i !== index);
        setGrid(newGrid);
    };

    const handlePaste = (e: React.ClipboardEvent, startRow: number, startCol: number) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const rows = text.split(/\r?\n/).filter(r => r.length > 0);
        
        const newGrid = [...grid];
        
        rows.forEach((rowText, rIdx) => {
            const cells = rowText.split('\t');
            const targetRow = startRow + rIdx;
            
            // Ensure we have enough rows
            if (!newGrid[targetRow]) {
                newGrid[targetRow] = ["", "", "", ""];
            }
            
            cells.forEach((cellText, cIdx) => {
                const targetCol = startCol + cIdx;
                if (targetCol < CATEGORIES.length) {
                    newGrid[targetRow][targetCol] = cellText.trim().toUpperCase();
                }
            });
        });
        
        setGrid(newGrid);
        notify.success("Pegado exitoso", "Se han actualizado los laboratorios desde el portapapeles.");
    };

    const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
        if (e.key === 'Enter') {
            if (row === grid.length - 1) addRow();
            setFocusedCell({ row: row + 1, col });
        } else if (e.key === 'ArrowUp' && row > 0) {
            setFocusedCell({ row: row - 1, col });
        } else if (e.key === 'ArrowDown') {
            if (row === grid.length - 1) addRow();
            setFocusedCell({ row: row + 1, col });
        } else if (e.key === 'ArrowLeft' && col > 0) {
            setFocusedCell({ row, col: col - 1 });
        } else if (e.key === 'ArrowRight' && col < 3) {
            setFocusedCell({ row, col: col + 1 });
        }
    };

    const handleFinalize = async () => {
        const payload = CATEGORIES.map((cat, colIdx) => ({
            category: cat,
            labs: grid.map(row => row[colIdx]).filter(l => l.trim().length > 0)
        }));
        await onSave(payload);
    };

    const isCritical = (lab: string, category: string) => {
        return criticalLabs.has(`${lab.toUpperCase()}|${category.toUpperCase()}`);
    };

    return (
        <Frame className="w-full border-muted/40 shadow-sm overflow-hidden bg-card/30 ">
            <FrameHeader className="border-b border-muted/20 bg-muted/5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <FrameTitle className="text-xl flex items-center gap-2">
                            <Paste className="w-5 h-5 text-primary" />
                            Editor de Laboratorios: <span className="text-primary">{branchName}</span>
                        </FrameTitle>
                        <FrameDescription>
                            Edita manualmente, usa flechas para navegar o pega directamente desde Excel.
                        </FrameDescription>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={addRow} className="flex-1 sm:flex-none h-9 px-4 gap-2">
                            <Add className="w-4 h-4" />
                            Fila
                        </Button>
                        <Button variant="default" size="sm" onClick={handleFinalize} disabled={isSaving || isLoading} className="flex-1 sm:flex-none h-9 px-6 gap-2 shadow-lg shadow-primary/20">
                            <Save className="w-4 h-4" />
                            {isSaving ? "Guardando..." : "Finalizar"}
                        </Button>
                    </div>
                </div>
            </FrameHeader>

            <FramePanel className="p-0">
                <ScrollArea className="h-[600px]">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur shadow-sm">
                            <TableRow className="hover:bg-transparent border-b-2 border-muted/20">
                                {CATEGORIES.map((cat) => (
                                    <TableHead key={cat} className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground/80 py-4 text-center">
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 pointer-events-none px-3">
                                            {cat}
                                        </Badge>
                                    </TableHead>
                                ))}
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                                        Cargando laboratorios...
                                    </TableCell>
                                </TableRow>
                            ) : grid.map((row, rIdx) => (
                                <TableRow key={rIdx} className="group hover:bg-muted/5 border-muted/10 transition-colors">
                                    {row.map((cell, cIdx) => (
                                        <TableCell key={cIdx} className="p-0 min-w-[150px] border-r border-muted/10 last:border-r-0">
                                            <input
                                                type="text"
                                                value={cell}
                                                onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                                onPaste={(e) => handlePaste(e, rIdx, cIdx)}
                                                onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                                                onFocus={() => setFocusedCell({ row: rIdx, col: cIdx })}
                                                ref={(el) => {
                                                    if (focusedCell?.row === rIdx && focusedCell?.col === cIdx) {
                                                        el?.focus();
                                                    }
                                                }}
                                                placeholder="..."
                                                className={cn(
                                                    "w-full h-12 bg-transparent px-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 rounded-none transition-all text-center",
                                                    cell && isCritical(cell, CATEGORIES[cIdx]) && "text-destructive font-bold bg-destructive/5 placeholder:text-destructive/30"
                                                )}
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell className="p-0 text-center">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => removeRow(rIdx)}
                                            className="opacity-0 group-hover:opacity-100 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
                                        >
                                            <Trash className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && grid.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                                        No hay laboratorios asignados. Haz clic en "Añadir Fila" o pega desde Excel.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                
                {criticalLabs.size > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/5 border-t border-destructive/10 text-[10px] text-destructive font-bold uppercase tracking-wider">
                        <Info className="w-4 h-4" />
                        Atención: Los laboratorios en rojo tienen progreso. No borrar a menos que sea necesario.
                    </div>
                )}
            </FramePanel>
        </Frame>
    );
}

