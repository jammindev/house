// nextjs/src/components/debug/ErrorBoundary.tsx
"use client";

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    showDetails?: boolean;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
    errorId?: string;
}

/**
 * Error Boundary pour capturer et afficher les erreurs React
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            error,
            errorInfo,
            errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Log en développement
        if (process.env.NODE_ENV === 'development') {
            console.group('🚨 Error Boundary Caught an Error');
            console.error('Error:', error);
            console.error('Error Info:', errorInfo);
            console.groupEnd();
        }

        // En production, vous pourriez envoyer à un service de logging
        if (process.env.NODE_ENV === 'production') {
            // logErrorToService(error, errorInfo, this.state.errorId);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    handleRefresh = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex items-center justify-center p-6">
                    <Card className="w-full max-w-2xl border-red-200">
                        <CardHeader className="text-center">
                            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle className="w-8 h-8 text-red-600" />
                            </div>
                            <CardTitle className="text-red-900">Une erreur s'est produite</CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            <Alert variant="destructive">
                                <Bug className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Erreur:</strong> {this.state.error?.message || 'Erreur inconnue'}
                                </AlertDescription>
                            </Alert>

                            {this.props.showDetails && this.state.error && (
                                <details className="text-sm">
                                    <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                                        Détails techniques
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                        <div>
                                            <strong>Stack Trace:</strong>
                                            <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap border">
                                                {this.state.error.stack}
                                            </pre>
                                        </div>

                                        {this.state.errorInfo && (
                                            <div>
                                                <strong>Component Stack:</strong>
                                                <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap border">
                                                    {this.state.errorInfo.componentStack}
                                                </pre>
                                            </div>
                                        )}

                                        <div>
                                            <strong>Error ID:</strong>
                                            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                                                {this.state.errorId}
                                            </code>
                                        </div>
                                    </div>
                                </details>
                            )}

                            <div className="flex gap-3 justify-center">
                                <Button
                                    onClick={this.handleRetry}
                                    variant="outline"
                                    size="sm"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Réessayer
                                </Button>

                                <Button
                                    onClick={this.handleRefresh}
                                    variant="default"
                                    size="sm"
                                >
                                    Recharger la page
                                </Button>
                            </div>

                            {process.env.NODE_ENV === 'development' && (
                                <div className="mt-4 text-center">
                                    <p className="text-xs text-gray-500">
                                        Mode développement - Consultez la console pour plus de détails
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook version de l'Error Boundary (pour usage conditionnel)
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode,
    showDetails: boolean = process.env.NODE_ENV === 'development'
) {
    return function WrappedComponent(props: P) {
        return (
            <ErrorBoundary fallback={fallback} showDetails={showDetails}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}