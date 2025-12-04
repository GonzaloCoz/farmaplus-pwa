import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Mail, ArrowUpDown } from 'lucide-react';

type Branch = {
    name: string;
    address: string;
    zonal: string;
    email: string;
};

interface BranchesTableWidgetProps {
    branches: Branch[];
}

const INITIAL_BRANCHES_TO_SHOW = 5;

export function BranchesTableWidget({ branches }: BranchesTableWidgetProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [showAllBranches, setShowAllBranches] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Branch; direction: 'ascending' | 'descending' }>({
        key: 'name',
        direction: 'ascending'
    });

    const filteredBranches = branches.filter(
        (branch) =>
            branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            branch.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
            branch.zonal.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (branch.email && branch.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const sortedBranches = useMemo(() => {
        let sortableItems = [...filteredBranches];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredBranches, sortConfig]);

    const requestSort = (key: keyof Branch) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const branchesToShow = showAllBranches
        ? sortedBranches
        : sortedBranches.slice(0, INITIAL_BRANCHES_TO_SHOW);

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Sucursales</h2>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar sucursal..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer" onClick={() => requestSort('name')}>
                                <div className="flex items-center">
                                    Sucursal
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </div>
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => requestSort('zonal')}>
                                <div className="flex items-center">
                                    Zonal
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </div>
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => requestSort('address')}>
                                <div className="flex items-center">
                                    Dirección
                                    <ArrowUpDown className="ml-2 h-4 w-4" />
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Contacto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {branchesToShow.map((branch, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{branch.name}</TableCell>
                                <TableCell>{branch.zonal}</TableCell>
                                <TableCell>{branch.address}</TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="ghost" size="icon">
                                        <a href={`mailto:${branch.email}`}>
                                            <Mail className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {sortedBranches.length > INITIAL_BRANCHES_TO_SHOW && (
                <div className="mt-4 text-center">
                    <Button
                        variant="outline"
                        onClick={() => setShowAllBranches(!showAllBranches)}
                    >
                        {showAllBranches ? 'Mostrar menos' : `Mostrar todas (${sortedBranches.length})`}
                    </Button>
                </div>
            )}
        </Card>
    );
}
