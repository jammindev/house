// nextjs/src/hooks/usePerformanceMonitor.ts
import { useState, useEffect, useCallback } from 'react';

interface PerformanceData {
    fps: number;
    memoryUsage: number;
    loadTime: number;
    renderTime: number;
    networkLatency: number;
    isSlowDevice: boolean;
}

/**
 * Hook pour surveiller les performances en temps réel
 */
export function usePerformanceMonitor() {
    const [performanceData, setPerformanceData] = useState<PerformanceData>({
        fps: 60,
        memoryUsage: 0,
        loadTime: 0,
        renderTime: 0,
        networkLatency: 0,
        isSlowDevice: false
    });

    const [isMonitoring, setIsMonitoring] = useState(false);

    // FPS Monitoring
    const measureFPS = useCallback(() => {
        let frameCount = 0;
        const startTime = performance.now();

        const measureFrame = () => {
            frameCount++;
            if (performance.now() - startTime < 1000) {
                requestAnimationFrame(measureFrame);
            } else {
                const fps = Math.round(frameCount);
                setPerformanceData(prev => ({ ...prev, fps }));
            }
        };

        requestAnimationFrame(measureFrame);
    }, []);

    // Memory Usage
    const measureMemoryUsage = useCallback(() => {
        if ('memory' in performance) {
            const memory = (performance as any).memory;
            const memoryUsage = memory.usedJSHeapSize / 1048576; // MB
            setPerformanceData(prev => ({ ...prev, memoryUsage }));
        }
    }, []);

    // Network Latency Test
    const measureNetworkLatency = useCallback(async () => {
        const start = performance.now();
        try {
            await fetch('/api/ping', { method: 'HEAD' });
            const latency = performance.now() - start;
            setPerformanceData(prev => ({ ...prev, networkLatency: latency }));
        } catch {
            // Fallback: use a simple resource request timing
            const start = performance.now();
            const img = new Image();
            img.onload = () => {
                const latency = performance.now() - start;
                setPerformanceData(prev => ({ ...prev, networkLatency: latency }));
            };
            img.src = '/favicon.ico?' + Date.now();
        }
    }, []);

    // Device Performance Detection
    const detectSlowDevice = useCallback(() => {
        const connection = (navigator as any).connection;
        const isSlowConnection = connection && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
        const isLowMemory = performanceData.memoryUsage > 100; // Plus de 100MB
        const isLowFPS = performanceData.fps < 30;

        const isSlowDevice = isSlowConnection || isLowMemory || isLowFPS;
        setPerformanceData(prev => ({ ...prev, isSlowDevice }));
    }, [performanceData.memoryUsage, performanceData.fps]);

    // Load Time
    useEffect(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
            const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
            const renderTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
            setPerformanceData(prev => ({ ...prev, loadTime, renderTime }));
        }
    }, []);

    // Monitoring Loop
    useEffect(() => {
        if (!isMonitoring) return;

        const interval = setInterval(() => {
            measureFPS();
            measureMemoryUsage();
            measureNetworkLatency();
            detectSlowDevice();
        }, 5000);

        return () => clearInterval(interval);
    }, [isMonitoring, measureFPS, measureMemoryUsage, measureNetworkLatency, detectSlowDevice]);

    const startMonitoring = useCallback(() => {
        setIsMonitoring(true);
    }, []);

    const stopMonitoring = useCallback(() => {
        setIsMonitoring(false);
    }, []);

    const getPerformanceScore = useCallback(() => {
        const fpsScore = Math.min(performanceData.fps / 60 * 100, 100);
        const memoryScore = Math.max(100 - performanceData.memoryUsage / 2, 0);
        const loadScore = Math.max(100 - performanceData.loadTime / 50, 0);
        const networkScore = Math.max(100 - performanceData.networkLatency / 10, 0);

        return Math.round((fpsScore + memoryScore + loadScore + networkScore) / 4);
    }, [performanceData]);

    const getRecommendations = useCallback(() => {
        const recommendations: string[] = [];

        if (performanceData.fps < 30) {
            recommendations.push('FPS faible détecté - considérez réduire les animations');
        }

        if (performanceData.memoryUsage > 100) {
            recommendations.push('Utilisation mémoire élevée - vérifiez les fuites mémoire');
        }

        if (performanceData.loadTime > 3000) {
            recommendations.push('Temps de chargement lent - optimisez les ressources');
        }

        if (performanceData.networkLatency > 1000) {
            recommendations.push('Latence réseau élevée - implémentez un cache local');
        }

        if (performanceData.isSlowDevice) {
            recommendations.push('Appareil lent détecté - adaptez l\'interface');
        }

        return recommendations;
    }, [performanceData]);

    return {
        performanceData,
        isMonitoring,
        startMonitoring,
        stopMonitoring,
        getPerformanceScore,
        getRecommendations
    };
}