
import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error in widget:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-destructive/5 text-center space-y-3 rounded-lg border border-destructive/20">
                    <AlertCircle className="w-8 h-8 text-destructive opacity-80" />
                    <div className="space-y-1">
                        <h3 className="font-medium text-destructive">Error en el widget</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 max-w-[200px]">
                            {this.state.error?.message || "Algo salió mal"}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-2"
                        onClick={() => this.setState({ hasError: false })}
                    >
                        <RefreshCw className="w-3 h-3" />
                        Reintentar
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
