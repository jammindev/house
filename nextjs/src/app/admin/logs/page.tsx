// System logs page
import { AdminHeader } from '@/features/admin/components/AdminNav';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, Search, Download, Filter, AlertTriangle } from 'lucide-react';

export default function AdminLogsPage() {
    const mockLogs = [
        {
            timestamp: '2024-12-07T10:15:32Z',
            level: 'INFO',
            source: 'auth',
            message: 'User login successful',
            user: 'user@example.com',
            ip: '192.168.1.100'
        },
        {
            timestamp: '2024-12-07T10:12:45Z',
            level: 'WARN',
            source: 'api',
            message: 'Rate limit approaching for user',
            user: 'user@example.com',
            ip: '192.168.1.100'
        },
        {
            timestamp: '2024-12-07T10:08:21Z',
            level: 'ERROR',
            source: 'storage',
            message: 'Failed to upload file: size exceeded',
            user: 'test@example.com',
            ip: '192.168.1.50'
        },
        {
            timestamp: '2024-12-07T10:05:15Z',
            level: 'INFO',
            source: 'system',
            message: 'Database backup completed successfully',
            user: 'system',
            ip: 'localhost'
        }
    ];

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'bg-red-100 text-red-800';
            case 'WARN': return 'bg-yellow-100 text-yellow-800';
            case 'INFO': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('fr-FR');
    };

    return (
        <div className="flex-1">
            <AdminHeader
                title="Logs système"
                description="Monitoring et analyse des journaux d'activité"
                action={
                    <Button variant="outline" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Exporter
                    </Button>
                }
            />
            <div className="p-6">
                <div className="space-y-6">
                    {/* Filters */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Rechercher dans les logs..."
                                        className="pl-8"
                                    />
                                </div>
                                <select className="h-10 px-3 rounded-md border border-input bg-background">
                                    <option value="">Tous les niveaux</option>
                                    <option value="ERROR">Erreurs</option>
                                    <option value="WARN">Avertissements</option>
                                    <option value="INFO">Informations</option>
                                </select>
                                <select className="h-10 px-3 rounded-md border border-input bg-background">
                                    <option value="">Toutes les sources</option>
                                    <option value="auth">Authentification</option>
                                    <option value="api">API</option>
                                    <option value="storage">Stockage</option>
                                    <option value="system">Système</option>
                                </select>
                                <Button variant="outline" size="sm">
                                    <Filter className="h-4 w-4 mr-2" />
                                    Filtrer
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Logs */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Journaux d'activité
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {mockLogs.map((log, index) => (
                                    <div key={index} className="flex items-start gap-4 p-3 border rounded-lg hover:bg-muted/50">
                                        <div className="flex-shrink-0">
                                            <Badge className={`text-xs ${getLevelColor(log.level)}`}>
                                                {log.level}
                                            </Badge>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm">{log.source}</span>
                                                <span className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-1">{log.message}</p>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span>Utilisateur: {log.user}</span>
                                                <span>IP: {log.ip}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Fonctionnalité en développement</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <AlertTriangle className="h-4 w-4" />
                                <p className="text-sm">L'analyse avancée des logs et les alertes automatiques seront disponibles dans une prochaine version.</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}