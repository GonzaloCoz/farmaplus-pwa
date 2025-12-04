import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Delete, Equal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalculatorProps {
    onResult: (result: number) => void;
    onClose: () => void;
    initialValue?: string;
}

export function Calculator({ onResult, onClose, initialValue = '' }: CalculatorProps) {
    const [display, setDisplay] = useState(initialValue);
    const [expression, setExpression] = useState('');

    const handleNumber = (num: string) => {
        setDisplay(prev => (prev === '0' ? num : prev + num));
    };

    const handleOperator = (op: string) => {
        setExpression(display + ' ' + op + ' ');
        setDisplay('');
    };

    const handleClear = () => {
        setDisplay('');
        setExpression('');
    };

    const handleEqual = () => {
        try {
            // Note: Using eval is generally unsafe, but for a local calculator with restricted input (only numbers and operators), it's acceptable.
            // Alternatively, we could write a simple parser.
            const fullExpr = expression + display;
            // Sanitize input just in case
            if (!/^[0-9+\-*/. ]+$/.test(fullExpr)) {
                setDisplay('Error');
                return;
            }
            // eslint-disable-next-line no-new-func
            const result = new Function('return ' + fullExpr)();
            setDisplay(String(result));
            setExpression('');
            onResult(Number(result));
        } catch (e) {
            setDisplay('Error');
        }
    };

    const handleBackspace = () => {
        setDisplay(prev => prev.slice(0, -1));
    };

    const buttons = [
        { label: 'C', onClick: handleClear, variant: 'destructive', className: 'col-span-1' },
        { label: '/', onClick: () => handleOperator('/'), variant: 'secondary' },
        { label: '*', onClick: () => handleOperator('*'), variant: 'secondary' },
        { label: <Delete className="w-4 h-4" />, onClick: handleBackspace, variant: 'secondary' },

        { label: '7', onClick: () => handleNumber('7'), variant: 'outline' },
        { label: '8', onClick: () => handleNumber('8'), variant: 'outline' },
        { label: '9', onClick: () => handleNumber('9'), variant: 'outline' },
        { label: '-', onClick: () => handleOperator('-'), variant: 'secondary' },

        { label: '4', onClick: () => handleNumber('4'), variant: 'outline' },
        { label: '5', onClick: () => handleNumber('5'), variant: 'outline' },
        { label: '6', onClick: () => handleNumber('6'), variant: 'outline' },
        { label: '+', onClick: () => handleOperator('+'), variant: 'secondary' },

        { label: '1', onClick: () => handleNumber('1'), variant: 'outline' },
        { label: '2', onClick: () => handleNumber('2'), variant: 'outline' },
        { label: '3', onClick: () => handleNumber('3'), variant: 'outline' },
        { label: '=', onClick: handleEqual, variant: 'default', className: 'row-span-2 h-full' },

        { label: '0', onClick: () => handleNumber('0'), variant: 'outline', className: 'col-span-2' },
        { label: '.', onClick: () => handleNumber('.'), variant: 'outline' },
    ];

    return (
        <div className="p-4 bg-card rounded-lg border shadow-lg max-w-xs mx-auto">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground font-mono h-4 block">{expression}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                    <X className="w-4 h-4" />
                </Button>
            </div>
            <div className="bg-muted p-3 rounded-md mb-4 text-right font-mono text-2xl font-bold tracking-wider overflow-hidden">
                {display || '0'}
            </div>
            <div className="grid grid-cols-4 gap-2">
                {buttons.map((btn, i) => (
                    <Button
                        key={i}
                        variant={btn.variant as any}
                        onClick={btn.onClick}
                        className={cn("h-12 text-lg font-medium", btn.className)}
                    >
                        {btn.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
