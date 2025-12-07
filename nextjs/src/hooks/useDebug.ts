// nextjs/src/hooks/useDebug.ts
import { useState, useCallback, useEffect } from 'react';

interface DebugOptions {
    enableConsoleCapture?: boolean;
    enablePerformanceMonitoring?: boolean;
    enableErrorBoundary?: boolean;
}

interface DebugMetrics {
    renderCount: number;
    lastRenderTime: number;
    totalRenderTime: number;
    errorCount: number;
    warningCount: number;
}

/**
 * Hook de debugging pour surveiller les performances et capturer les erreurs
 */
export function useDebug(componentName: string, options: DebugOptions = {}) {
    const {
        enableConsoleCapture = false,
        enablePerformanceMonitoring = true,
        enableErrorBoundary = true
    } = options;

    const [metrics, setMetrics] = useState<DebugMetrics>({
        renderCount: 0,
        lastRenderTime: 0,
        totalRenderTime: 0,
        errorCount: 0,
        warningCount: 0
    });

    const [renderStart] = useState(() => performance.now());

    // Incrémenter le compteur de renders
    useEffect(() => {
        const renderEnd = performance.now();
        const renderTime = renderEnd - renderStart;

        setMetrics(prev => ({
            ...prev,
            renderCount: prev.renderCount + 1,
            lastRenderTime: renderTime,
            totalRenderTime: prev.totalRenderTime + renderTime
        }));

        if (enablePerformanceMonitoring && process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] ${componentName} rendered in ${renderTime.toFixed(2)}ms (render #${metrics.renderCount + 1})`);
        }
    });

    const logError = useCallback((error: Error, context?: string) => {
        setMetrics(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));

        if (enableErrorBoundary) {
            console.error(`[ERROR] ${componentName}${context ? ` (${context})` : ''}:`, error);
        }
    }, [componentName, enableErrorBoundary]);

    const logWarning = useCallback((message: string, context?: string) => {
        setMetrics(prev => ({ ...prev, warningCount: prev.warningCount + 1 }));

        if (enableConsoleCapture) {
            console.warn(`[WARNING] ${componentName}${context ? ` (${context})` : ''}: ${message}`);
        }
    }, [componentName, enableConsoleCapture]);

    const logInfo = useCallback((message: string, data?: any) => {
        if (enableConsoleCapture && process.env.NODE_ENV === 'development') {
            console.log(`[INFO] ${componentName}: ${message}`, data);
        }
    }, [componentName, enableConsoleCapture]);

    const resetMetrics = useCallback(() => {
        setMetrics({
            renderCount: 0,
            lastRenderTime: 0,
            totalRenderTime: 0,
            errorCount: 0,
            warningCount: 0
        });
    }, []);

    return {
        metrics,
        logError,
        logWarning,
        logInfo,
        resetMetrics
    };
}