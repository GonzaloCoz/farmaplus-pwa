import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Frame, FramePanel } from "@/components/ui/frame"
import { formatCurrency } from "@/lib/utils"

interface ComparisonData {
    branchName: string
    progress: number
    totalStockValue: number
    differenceValue: number
    netValue: number
    totalItems: number
    controlledItems: number
}

interface ComparisonTableProps {
    data: ComparisonData[]
}

export function ComparisonTable({ data }: ComparisonTableProps) {
    return (
        <Frame>
            <FramePanel className="p-0 overflow-hidden">
                <Table>
                    <TableHeader className="bg-transparent">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="pl-6 font-semibold py-4">Sucursal</TableHead>
                            <TableHead className="text-right font-semibold">Progreso</TableHead>
                            <TableHead className="text-right font-semibold">Items Controlados</TableHead>
                            <TableHead className="text-right font-semibold">Total Sistema ($)</TableHead>
                            <TableHead className="text-right pr-6 font-semibold">Diferencia ($)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="bg-background rounded-l-xl rounded-r-xl overflow-hidden shadow-xs/5">
                        {data.map((row) => (
                            <TableRow key={row.branchName} className="border-t border-border/40 first:border-none">
                                <TableCell className="font-semibold text-foreground/90 pl-6 py-4">{row.branchName}</TableCell>
                                <TableCell className="text-right font-bold text-primary">
                                    {row.progress}%
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground/80 font-medium">
                                    {row.controlledItems} / {row.totalItems}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-semibold">
                                    {formatCurrency(row.totalStockValue)}
                                </TableCell>
                                <TableCell className={`text-right font-bold pr-6 font-mono text-xs ${row.differenceValue < 0 ? 'text-destructive/80' : 'text-emerald-600'}`}>
                                    {row.differenceValue > 0 ? '+' : ''}{formatCurrency(row.differenceValue)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </FramePanel>
        </Frame>
    )
}
