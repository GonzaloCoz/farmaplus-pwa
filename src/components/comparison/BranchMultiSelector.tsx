import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { useUserBranches } from "@/hooks/useUserBranches"

interface BranchMultiSelectorProps {
    selectedBranches: string[]
    onChange: (branches: string[]) => void
}

export function BranchMultiSelector({ selectedBranches, onChange }: BranchMultiSelectorProps) {
    const [open, setOpen] = React.useState(false)
    const { availableBranches } = useUserBranches()

    const handleSelect = (currentValue: string) => {
        const isSelected = selectedBranches.includes(currentValue)
        let newSelected: string[]

        if (isSelected) {
            newSelected = selectedBranches.filter((val) => val !== currentValue)
        } else {
            newSelected = [...selectedBranches, currentValue]
        }

        onChange(newSelected)
    }

    const handleRemove = (e: React.MouseEvent, branch: string) => {
        e.stopPropagation()
        onChange(selectedBranches.filter((b) => b !== branch))
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between min-h-10 h-auto"
                >
                    <div className="flex flex-wrap gap-1 items-center text-left">
                        {selectedBranches.length > 0 ? (
                            <>
                                <span className="hidden sm:inline mr-1 text-muted-foreground font-normal">Comparar:</span>
                                {selectedBranches.slice(0, 3).map(branch => (
                                    <Badge key={branch} variant="secondary" className="mr-1 text-xs">
                                        {branch}
                                        <div
                                            className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                                            onClick={(e) => handleRemove(e, branch)}
                                        >
                                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                        </div>
                                    </Badge>
                                ))}
                                {selectedBranches.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                        +{selectedBranches.length - 3} más
                                    </Badge>
                                )}
                            </>
                        ) : (
                            <span className="text-muted-foreground">Seleccionar sucursales...</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Buscar sucursal..." />
                    <CommandList>
                        <CommandEmpty>No se encontraron sucursales.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-y-auto">
                            {availableBranches.map((branch) => (
                                <CommandItem
                                    key={branch}
                                    value={branch}
                                    onSelect={handleSelect}
                                >
                                    <div
                                        className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            selectedBranches.includes(branch)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                        )}
                                    >
                                        <Check className={cn("h-4 w-4")} />
                                    </div>
                                    {branch}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
