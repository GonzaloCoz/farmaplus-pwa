import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, FileEdit, Trash2 } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ReturnItem } from "@/services/returnsService"
import { format } from "date-fns"

interface ReturnsTableProps {
    data: ReturnItem[]
    onEdit: (item: ReturnItem) => void
    onDelete: (id: string) => void
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    processing: "default",
    completed: "outline", // Green-ish usually, but outline for now
    rejected: "destructive"
}

const reasonLabels: Record<string, string> = {
    expired: "Vencido",
    damaged: "Dañado",
    recall: "Recall",
    other: "Otro"
}

export function ReturnsTable({ data, onEdit, onDelete }: ReturnsTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cantidad</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(item.created_at), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-medium">{item.product_name}</span>
                                    <span className="text-xs text-muted-foreground">{item.product_ean}</span>
                                </div>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{reasonLabels[item.reason] || item.reason}</TableCell>
                            <TableCell>
                                <Badge variant={statusColors[item.status] || "default"} className="capitalize">
                                    {item.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Abrir menú</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit(item)}>
                                            <FileEdit className="mr-2 h-4 w-4" />
                                            Editar / Procesar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onDelete(item.id)} className="text-red-600">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {data.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No hay devoluciones registradas.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
