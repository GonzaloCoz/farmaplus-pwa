import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Sucursal</TableHead>
                        <TableHead className="text-right">Progreso</TableHead>
                        <TableHead className="text-right">Items Controlados</TableHead>
                        <TableHead className="text-right">Total Sistema ($)</TableHead>
                        <TableHead className="text-right">Diferencia ($)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row) => (
                        <TableRow key={row.branchName}>
                            <TableCell className="font-medium">{row.branchName}</TableCell>
                            <TableCell className="text-right font-bold text-primary">
                                {row.progress}%
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {row.controlledItems} / {row.totalItems}
                            </TableCell>
                            <TableCell className="text-right">
                                {formatCurrency(row.totalStockValue)}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${row.differenceValue < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                {row.differenceValue > 0 ? '+' : ''}{formatCurrency(row.differenceValue)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
