import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Delete, XClose as X } from '@untitledui/icons';
import { cn } from '@/lib/utils';

interface CalculatorProps {
    onResult: (result: number) => void;
    onClose: () => void;
    initialValue?: string;
}

function safeEvaluate(expr: string): number {
    const cleanExpr = expr.replace(/\s+/g, '');
    const tokens: (string | number)[] = [];
    let numberBuffer = '';
    
    for (let i = 0; i < cleanExpr.length; i++) {
        const char = cleanExpr[i];
        if (/[0-9.]/.test(char)) {
            numberBuffer += char;
        } else if (['+', '-', '*', '/'].includes(char)) {
            if (numberBuffer) {
                tokens.push(parseFloat(numberBuffer));
                numberBuffer = '';
            }
            if (char === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string')) {
                numberBuffer = '-';
            } else {
                tokens.push(char);
            }
        } else {
            throw new Error('Invalid character');
        }
    }
    if (numberBuffer) {
        if (numberBuffer === '-') throw new Error('Invalid expression');
        tokens.push(parseFloat(numberBuffer));
    }

    if (tokens.length === 0) return 0;
    if (typeof tokens[tokens.length - 1] === 'string') {
        throw new Error('Incomplete expression');
    }

    const intermediateTokens: (string | number)[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '*' || token === '/') {
            const prev = intermediateTokens.pop();
            const next = tokens[++i];
            if (typeof prev !== 'number' || typeof next !== 'number') {
                throw new Error('Invalid operands');
            }
            if (token === '*') {
                intermediateTokens.push(prev * next);
            } else {
                if (next === 0) throw new Error('Division by zero');
                intermediateTokens.push(prev / next);
            }
        } else {
            intermediateTokens.push(token);
        }
    }

    if (intermediateTokens.length === 0) return 0;
    let result = intermediateTokens[0];
    if (typeof result !== 'number') throw new Error('Invalid expression');

    for (let i = 1; i < intermediateTokens.length; i += 2) {
        const op = intermediateTokens[i];
        const next = intermediateTokens[i + 1];
        if (typeof op !== 'string' || typeof next !== 'number') {
            throw new Error('Invalid expression');
        }
        if (op === '+') {
            result += next;
        } else if (op === '-') {
            result -= next;
        } else {
            throw new Error('Invalid operator');
        }
    }

    if (isNaN(result) || !isFinite(result)) {
        throw new Error('Calculation error');
    }

    return result;
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
            const fullExpr = expression + display;
            if (!/^[0-9+\-*/. ]+$/.test(fullExpr)) {
                setDisplay('Error');
                return;
            }
            const result = safeEvaluate(fullExpr);
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
        { label: 'DEL', onClick: handleBackspace, variant: 'secondary' },

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
