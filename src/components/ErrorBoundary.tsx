import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw01 as RefreshCw } from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // ponytail: reload on dynamic chunk load errors to auto-update active clients
        const isChunkError =
            error.name === 'ChunkLoadError' ||
            error.message?.includes('Failed to fetch dynamically imported module') ||
            error.message?.includes('error loading dynamically imported module') ||
            error.message?.includes('Importing a module script failed');

        if (isChunkError) {
            const hasReloaded = sessionStorage.getItem('chunk_error_reloaded');
            const now = Date.now();
            if (!hasReloaded || now - parseInt(hasReloaded, 10) > 10000) {
                sessionStorage.setItem('chunk_error_reloaded', now.toString());
                window.location.reload();
            }
        }
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error capturado por ErrorBoundary:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background">
                    <Card className="max-w-md w-full">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-destructive">
                                <AlertTriangle className="w-6 h-6" />
                                <CardTitle>Algo salió mal</CardTitle>
                            </div>
                            <CardDescription>
                                La aplicación encontró un error inesperado
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {this.state.error && (
                                <div className="p-3 bg-muted rounded-md">
                                    <p className="text-sm font-mono text-muted-foreground">
                                        {this.state.error.message}
                                    </p>
                                </div>
                            )}
                            <Button onClick={this.handleReset} className="w-full">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Recargar Aplicación
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
