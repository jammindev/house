// nextjs/src/components/debug/DebugPage.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Monitor, Database, Clock, Bug, Settings, Users,
    HardDrive, Network, Zap, AlertTriangle, CheckCircle,
    RefreshCw, Download, Trash2, Eye, Code, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Z_INDEX, Z_INDEX_CLASSES } from '@/lib/design-tokens';
import { ZIndexDebugger } from '../dev/ZIndexDebugger';

interface DebugInfo {
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    data?: any;
}

interface PerformanceMetrics {
    pageLoadTime: number;
    renderTime: number;
    memoryUsage: number;
    networkRequests: number;
}

interface DatabaseStats {
    households: number;
    interactions: number;
    zones: number;
    documents: number;
    projects: number;
    equipment: number;
}

export default function DebugPage() {
    const { user, households, selectedHouseholdId, loading } = useGlobal();
    const { t } = useI18n();

    // Debug state
    const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
    const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
    const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
    const [isCollecting, setIsCollecting] = useState(false);
    const [errors, setErrors] = useState<Error[]>([]);
    const [networkLogs, setNetworkLogs] = useState<any[]>([]);

    // Client-side info to prevent hydration errors
    const [clientInfo, setClientInfo] = useState<{
        userAgent: string;
        language: string;
        timezone: string;
    } | null>(null);

    // Tabs
    const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'performance' | 'database' | 'network' | 'zindex' | 'tools'>('overview');

    // Console capture
    const originalConsole = useRef<{
        log: typeof console.log;
        warn: typeof console.warn;
        error: typeof console.error;
    }>({
        log: console.log,
        warn: console.warn,
        error: console.error
    });

    const addDebugLog = useCallback((level: 'info' | 'warn' | 'error', message: string, data?: any) => {
        setDebugLogs(prev => [
            {
                timestamp: new Date().toISOString(),
                level,
                message,
                data
            },
            ...prev.slice(0, 99) // Keep only last 100 logs
        ]);
    }, []);

    // Load client-side info to prevent hydration errors
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setClientInfo({
                userAgent: navigator.userAgent.split(' ').pop() || '',
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            });
        }
    }, []);

    // Capture console logs
    useEffect(() => {
        if (!originalConsole.current) {
            originalConsole.current = {
                log: console.log,
                warn: console.warn,
                error: console.error
            };
        }

        if (isCollecting) {
            console.log = (...args) => {
                originalConsole.current!.log(...args);
                addDebugLog('info', args.join(' '), args);
            };

            console.warn = (...args) => {
                originalConsole.current!.warn(...args);
                addDebugLog('warn', args.join(' '), args);
            };

            console.error = (...args) => {
                originalConsole.current!.error(...args);
                addDebugLog('error', args.join(' '), args);
                if (args[0] instanceof Error) {
                    setErrors(prev => [...prev, args[0]]);
                }
            };
        } else {
            // Restore original console
            if (originalConsole.current) {
                console.log = originalConsole.current.log;
                console.warn = originalConsole.current.warn;
                console.error = originalConsole.current.error;
            }
        }

        return () => {
            if (originalConsole.current) {
                console.log = originalConsole.current.log;
                console.warn = originalConsole.current.warn;
                console.error = originalConsole.current.error;
            }
        };
    }, [isCollecting, addDebugLog]);

    // Performance monitoring
    useEffect(() => {
        const measurePerformance = () => {
            if (typeof window === 'undefined') return;

            const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            const memory = (window.performance as any).memory;

            setPerformance({
                pageLoadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
                renderTime: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
                memoryUsage: memory ? memory.usedJSHeapSize / 1048576 : 0, // MB
                networkRequests: window.performance.getEntriesByType('resource').length
            });
        };

        measurePerformance();
        const interval = setInterval(measurePerformance, 5000);
        return () => clearInterval(interval);
    }, []);

    // Database stats
    useEffect(() => {
        if (selectedHouseholdId) {
            fetchDatabaseStats();
        }
    }, [selectedHouseholdId]);

    const fetchDatabaseStats = async () => {
        if (!selectedHouseholdId) return;

        try {
            const supa = await createSPASassClientAuthenticated();
            const client = supa.getSupabaseClient();

            const [
                householdsCount,
                interactionsCount,
                zonesCount,
                documentsCount,
                projectsCount,
                equipmentCount
            ] = await Promise.all([
                client.from('households').select('id', { count: 'exact', head: true }),
                client.from('interactions').select('id', { count: 'exact', head: true }).eq('household_id', selectedHouseholdId!),
                client.from('zones').select('id', { count: 'exact', head: true }).eq('household_id', selectedHouseholdId!),
                client.from('documents').select('id', { count: 'exact', head: true }).eq('household_id', selectedHouseholdId!),
                client.from('projects').select('id', { count: 'exact', head: true }).eq('household_id', selectedHouseholdId!),
                client.from('equipment').select('id', { count: 'exact', head: true }).eq('household_id', selectedHouseholdId!)
            ]);

            setDbStats({
                households: householdsCount.count || 0,
                interactions: interactionsCount.count || 0,
                zones: zonesCount.count || 0,
                documents: documentsCount.count || 0,
                projects: projectsCount.count || 0,
                equipment: equipmentCount.count || 0
            });
        } catch (error) {
            addDebugLog('error', 'Failed to fetch database stats', error);
        }
    };

    const clearLogs = () => {
        setDebugLogs([]);
        setErrors([]);
        setNetworkLogs([]);
    };

    const exportLogs = () => {
        const data = {
            timestamp: new Date().toISOString(),
            user: user?.id,
            household: selectedHouseholdId,
            logs: debugLogs,
            errors: errors.map(e => ({ message: e.message, stack: e.stack })),
            performance,
            dbStats
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `house-debug-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const simulateError = () => {
        try {
            throw new Error('Debug: Simulated error for testing');
        } catch (error) {
            console.error(error);
        }
    };

    const testNetworkRequest = async () => {
        try {
            const start = window.performance.now();
            const supa = await createSPASassClientAuthenticated();
            const client = supa.getSupabaseClient();
            await client.from('households').select('count').limit(1);
            const duration = window.performance.now() - start;

            setNetworkLogs(prev => [
                {
                    timestamp: new Date().toISOString(),
                    endpoint: 'households',
                    method: 'GET',
                    duration: Math.round(duration),
                    status: 'success'
                },
                ...prev.slice(0, 19)
            ]);

            addDebugLog('info', `Network test completed in ${duration.toFixed(2)}ms`);
        } catch (error) {
            setNetworkLogs(prev => [
                {
                    timestamp: new Date().toISOString(),
                    endpoint: 'households',
                    method: 'GET',
                    duration: 0,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                },
                ...prev.slice(0, 19)
            ]);
            addDebugLog('error', 'Network test failed', error);
        }
    };

    const tabs = [
        { id: 'overview', label: 'Vue d\'ensemble', icon: Monitor },
        { id: 'logs', label: 'Logs', icon: Bug },
        { id: 'performance', label: 'Performance', icon: Zap },
        { id: 'database', label: 'Base de données', icon: Database },
        { id: 'network', label: 'Réseau', icon: Network },
        { id: 'zindex', label: 'Z-Index', icon: Eye },
        { id: 'tools', label: 'Outils', icon: Settings }
    ] as const;

    if (process.env.NODE_ENV !== 'development') {
        return (
            <div className="container mx-auto p-8">
                <Card>
                    <CardContent className="p-8 text-center">
                        <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Page de Debug Indisponible</h2>
                        <p className="text-muted-foreground">
                            Cette page n'est disponible qu'en mode développement.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Debug Console</h1>
                    <p className="text-muted-foreground">Outils de développement et monitoring</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant={isCollecting ? "destructive" : "default"}
                        size="sm"
                        onClick={() => setIsCollecting(!isCollecting)}
                    >
                        {isCollecting ? 'Arrêter' : 'Démarrer'} la collecte
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportLogs}>
                        <Download className="h-4 w-4 mr-2" />
                        Exporter
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearLogs}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Nettoyer
                    </Button>
                </div>
            </div>

            {/* Status Bar */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${isCollecting ? 'bg-green-500' : 'bg-gray-500'}`} />
                                <span className="text-sm">Collecte: {isCollecting ? 'Active' : 'Inactive'}</span>
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            <div className="text-sm">
                                Utilisateur: <Badge variant="outline">{user?.email || 'Non connecté'}</Badge>
                            </div>
                            <div className="text-sm">
                                Ménage: <Badge variant="outline">{selectedHouseholdId ? households.find(h => h.id === selectedHouseholdId)?.name : 'Aucun'}</Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant={errors.length > 0 ? "destructive" : "default"}>
                                {errors.length} Erreurs
                            </Badge>
                            <Badge variant="secondary">
                                {debugLogs.length} Logs
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* System Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Monitor className="h-5 w-5" />
                                Système
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Environnement:</span>
                                <Badge>{process.env.NODE_ENV}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">User Agent:</span>
                                <span className="text-xs text-right max-w-32 truncate">
                                    {clientInfo?.userAgent || 'Loading...'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Langue:</span>
                                <span className="text-xs">{clientInfo?.language || 'Loading...'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Timezone:</span>
                                <span className="text-xs">{clientInfo?.timezone || 'Loading...'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Performance Quick View */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5" />
                                Performance
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {performance && (
                                <>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span>Chargement page</span>
                                            <span>{performance.pageLoadTime.toFixed(0)}ms</span>
                                        </div>
                                        <Progress value={Math.min(performance.pageLoadTime / 30, 100)} className="h-2" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span>Mémoire</span>
                                            <span>{performance.memoryUsage.toFixed(1)}MB</span>
                                        </div>
                                        <Progress value={Math.min(performance.memoryUsage / 100, 100)} className="h-2" />
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Requêtes réseau</span>
                                        <span>{performance.networkRequests}</span>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Database Quick View */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                Base de données
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {dbStats ? (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Ménages:</span>
                                        <Badge variant="outline">{dbStats.households}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Interactions:</span>
                                        <Badge variant="outline">{dbStats.interactions}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Zones:</span>
                                        <Badge variant="outline">{dbStats.zones}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Documents:</span>
                                        <Badge variant="outline">{dbStats.documents}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Projets:</span>
                                        <Badge variant="outline">{dbStats.projects}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Équipements:</span>
                                        <Badge variant="outline">{dbStats.equipment}</Badge>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Chargement...</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'logs' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bug className="h-5 w-5" />
                            Logs Console ({debugLogs.length})
                        </CardTitle>
                        <CardDescription>
                            Logs capturés en temps réel depuis la console
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {debugLogs.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">
                                    Aucun log capturé. Activez la collecte pour voir les logs.
                                </p>
                            ) : (
                                debugLogs.map((log, index) => (
                                    <div
                                        key={index}
                                        className={`p-2 rounded text-xs border-l-2 ${log.level === 'error'
                                            ? 'bg-red-50 border-red-500 text-red-900'
                                            : log.level === 'warn'
                                                ? 'bg-yellow-50 border-yellow-500 text-yellow-900'
                                                : 'bg-blue-50 border-blue-500 text-blue-900'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <Badge variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'default' : 'secondary'}>
                                                {log.level.toUpperCase()}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="font-mono">{log.message}</div>
                                        {log.data && (
                                            <details className="mt-1">
                                                <summary className="cursor-pointer text-xs">Détails</summary>
                                                <pre className="mt-1 text-xs bg-background/50 p-2 rounded overflow-x-auto">
                                                    {JSON.stringify(log.data, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'performance' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5" />
                                Métriques Performance
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {performance ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Chargement page</h4>
                                        <div className="text-2xl font-bold">{performance.pageLoadTime.toFixed(0)}ms</div>
                                        <Progress value={Math.min(performance.pageLoadTime / 50, 100)} />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Rendu DOM</h4>
                                        <div className="text-2xl font-bold">{performance.renderTime.toFixed(0)}ms</div>
                                        <Progress value={Math.min(performance.renderTime / 30, 100)} />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Mémoire utilisée</h4>
                                        <div className="text-2xl font-bold">{performance.memoryUsage.toFixed(1)}MB</div>
                                        <Progress value={Math.min(performance.memoryUsage / 100, 100)} />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Requêtes réseau</h4>
                                        <div className="text-2xl font-bold">{performance.networkRequests}</div>
                                        <Progress value={Math.min(performance.networkRequests / 50, 100)} />
                                    </div>
                                </div>
                            ) : (
                                <p>Chargement des métriques...</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'database' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                Statistiques Base de Données
                            </CardTitle>
                            <CardDescription>
                                État des données pour le ménage sélectionné
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dbStats ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    {Object.entries(dbStats).map(([key, value]) => (
                                        <div key={key} className="text-center">
                                            <div className="text-2xl font-bold text-primary">{value}</div>
                                            <div className="text-sm text-muted-foreground capitalize">
                                                {key === 'households' ? 'Ménages' : key}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">Chargement des statistiques...</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={fetchDatabaseStats}
                                        className="mt-2"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Rafraîchir
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'network' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Network className="h-5 w-5" />
                            Surveillance Réseau
                        </CardTitle>
                        <CardDescription>
                            Logs des requêtes réseau et tests de connectivité
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={testNetworkRequest}>
                            Tester une requête
                        </Button>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {networkLogs.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4">
                                    Aucune requête réseau enregistrée
                                </p>
                            ) : (
                                networkLogs.map((log, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 border rounded text-sm">
                                        <div>
                                            <span className="font-medium">{log.method}</span> {log.endpoint}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span>{log.duration}ms</span>
                                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                                {log.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'zindex' && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="h-5 w-5 text-blue-600" />
                                Analyseur Z-Index
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Z-Index Token System */}
                            <div>
                                <h3 className="text-lg font-semibold mb-3">Tokens Z-Index</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Base</h4>
                                        <div className="space-y-1">
                                            {Object.entries(Z_INDEX.base).map(([key, value]) => (
                                                <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                                                    <code>base.{key}</code>
                                                    <span className="font-mono font-bold">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Navigation</h4>
                                        <div className="space-y-1">
                                            {Object.entries(Z_INDEX.navigation).map(([key, value]) => (
                                                <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                                                    <code>navigation.{key}</code>
                                                    <span className="font-mono font-bold">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Overlays</h4>
                                        <div className="space-y-1">
                                            {Object.entries(Z_INDEX.overlay).map(([key, value]) => (
                                                <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                                                    <code>overlay.{key}</code>
                                                    <span className="font-mono font-bold">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">System</h4>
                                        <div className="space-y-1">
                                            {Object.entries(Z_INDEX.system).map(([key, value]) => (
                                                <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                                                    <code>system.{key}</code>
                                                    <span className="font-mono font-bold">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Live Element Scanner */}
                            <div>
                                <h3 className="text-lg font-semibold mb-3">Éléments avec Z-Index</h3>
                                <Button
                                    onClick={() => {
                                        const elements = Array.from(document.querySelectorAll('*')).filter(el => {
                                            const style = getComputedStyle(el);
                                            return style.zIndex && style.zIndex !== 'auto';
                                        });
                                        console.log('Éléments avec z-index:', elements.map(el => ({
                                            element: el,
                                            zIndex: getComputedStyle(el).zIndex,
                                            class: el.className,
                                            id: el.id
                                        })));
                                    }}
                                    variant="outline"
                                    size="sm"
                                >
                                    Scanner les Z-Index actuels
                                </Button>
                                <p className="text-xs text-gray-500 mt-2">
                                    Vérifie la console pour voir tous les éléments avec z-index dans le DOM
                                </p>
                            </div>

                            {/* Tailwind Classes */}
                            <div>
                                <h3 className="text-lg font-semibold mb-3">Classes Tailwind Disponibles</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {Object.entries(Z_INDEX_CLASSES).filter(([_, value]) => typeof value === 'string').map(([key, value]) => (
                                        <div key={key} className="flex flex-col p-2 bg-gray-50 rounded text-xs">
                                            <code className="font-mono font-bold">.{key}</code>
                                            <code className="text-gray-600">{String(value)}</code>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'tools' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Outils de Test
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button onClick={simulateError} variant="destructive" size="sm">
                                Simuler une erreur
                            </Button>
                            <Button onClick={clearLogs} variant="outline" size="sm">
                                Nettoyer les logs
                            </Button>
                            <Button onClick={exportLogs} variant="outline" size="sm">
                                Exporter les données
                            </Button>
                            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                                Recharger la page
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="h-5 w-5" />
                                Outils Visuels
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                    Le debugger Z-Index est intégré à cette page et disponible via le bouton en bas à gauche.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open('/app/z-index-demo', '_blank')}
                                >
                                    Ouvrir la démo Z-Index
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            {/* Z-Index Debugger - Development only */}
            <ZIndexDebugger />
        </div>
    );
}