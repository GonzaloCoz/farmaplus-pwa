import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
    value: 'light' | 'dark' | 'auto' | 'system';
    onChange: (value: 'light' | 'dark' | 'auto') => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
    const themes = [
        {
            id: 'light' as const,
            label: 'Claro',
            preview: (
                <div className="relative w-full h-24 rounded-lg border-2 bg-white overflow-hidden">
                    {/* Header */}
                    <div className="h-3 bg-gray-100 border-b border-gray-200 flex items-center px-2 gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    </div>
                    {/* Content */}
                    <div className="p-2 space-y-1.5">
                        <div className="h-2 bg-gray-200 rounded w-3/4" />
                        <div className="h-2 bg-gray-200 rounded w-1/2" />
                        <div className="h-2 bg-gray-200 rounded w-2/3" />
                    </div>
                    {/* Accent */}
                    <div className="absolute top-3 right-2">
                        <div className="w-8 h-2 bg-blue-500 rounded" />
                    </div>
                </div>
            )
        },
        {
            id: 'dark' as const,
            label: 'Oscuro',
            preview: (
                <div className="relative w-full h-24 rounded-lg border-2 bg-gray-900 overflow-hidden">
                    {/* Header */}
                    <div className="h-3 bg-gray-800 border-b border-gray-700 flex items-center px-2 gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                    </div>
                    {/* Content */}
                    <div className="p-2 space-y-1.5">
                        <div className="h-2 bg-gray-700 rounded w-3/4" />
                        <div className="h-2 bg-gray-700 rounded w-1/2" />
                        <div className="h-2 bg-gray-700 rounded w-2/3" />
                    </div>
                    {/* Accent */}
                    <div className="absolute top-3 right-2">
                        <div className="w-8 h-2 bg-blue-400 rounded" />
                    </div>
                </div>
            )
        },
        {
            id: 'auto' as const,
            label: 'Automático',
            preview: (
                <div className="relative w-full h-24 rounded-lg border-2 overflow-hidden">
                    {/* Split view: left light, right dark */}
                    <div className="flex h-full">
                        {/* Light half */}
                        <div className="w-1/2 bg-white border-r border-gray-300">
                            <div className="h-3 bg-gray-100 border-b border-gray-200 flex items-center px-2 gap-1">
                                <div className="w-1 h-1 rounded-full bg-gray-300" />
                                <div className="w-1 h-1 rounded-full bg-gray-300" />
                            </div>
                            <div className="p-1.5 space-y-1">
                                <div className="h-1.5 bg-gray-200 rounded w-3/4" />
                                <div className="h-1.5 bg-gray-200 rounded w-1/2" />
                            </div>
                        </div>
                        {/* Dark half */}
                        <div className="w-1/2 bg-gray-900">
                            <div className="h-3 bg-gray-800 border-b border-gray-700 flex items-center px-2 gap-1">
                                <div className="w-1 h-1 rounded-full bg-gray-600" />
                                <div className="w-1 h-1 rounded-full bg-gray-600" />
                            </div>
                            <div className="p-1.5 space-y-1">
                                <div className="h-1.5 bg-gray-700 rounded w-3/4" />
                                <div className="h-1.5 bg-gray-700 rounded w-1/2" />
                            </div>
                        </div>
                    </div>
                    {/* Sun/Moon icon overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {themes.map((theme) => (
                <button
                    key={theme.id}
                    onClick={() => onChange(theme.id)}
                    className={cn(
                        "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all hover:shadow-md",
                        value === theme.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/50"
                    )}
                >
                    {theme.preview}
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                            value === theme.id
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                        )}>
                            {value === theme.id && (
                                <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                            )}
                        </div>
                        <span className={cn(
                            "text-sm font-medium",
                            value === theme.id ? "text-foreground" : "text-muted-foreground"
                        )}>
                            {theme.label}
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
}
