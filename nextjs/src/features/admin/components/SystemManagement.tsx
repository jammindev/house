// System configuration and monitoring
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, Database, HardDrive, Server, Activity, 
  AlertTriangle, CheckCircle, RefreshCw, Download,
  Trash2, Shield, Clock
} from 'lucide-react';

interface SystemInfo {
  database_status: 'online' | 'offline' | 'maintenance';
  storage_status: 'available' | 'low_space' | 'full';
  api_status: 'operational' | 'degraded' | 'down';
  version: string;
  uptime: string;
  last_backup: string;
  storage_used_gb: number;
  storage_total_gb: number;
}

export function SystemManagement() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemInfo = async () => {
    try {
      setLoading(true);
      
      // Mock system information
      const mockInfo: SystemInfo = {
        database_status: 'online',
        storage_status: 'available',
        api_status: 'operational',
        version: '1.0.0',
        uptime: '15 jours 3 heures',
        last_backup: '2024-12-07T02:00:00Z',
        storage_used_gb: 2.4,
        storage_total_gb: 100
      };

      setSystemInfo(mockInfo);
    } catch (err) {
      console.error('Error fetching system info:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des informations système');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'available':
      case 'operational':
        return 'text-green-600';
      case 'maintenance':
      case 'low_space':
      case 'degraded':
        return 'text-yellow-600';
      case 'offline':
      case 'full':
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    const isHealthy = ['online', 'available', 'operational'].includes(status);
    return (
      <Badge variant={isHealthy ? 'secondary' : 'destructive'} className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const handleBackupDatabase = async () => {
    console.log('Starting database backup...');
    // TODO: Implement backup functionality
  };

  const handleOptimizeDatabase = async () => {
    console.log('Optimizing database...');
    // TODO: Implement optimization
  };

  const handleCleanupStorage = async () => {
    if (confirm('Êtes-vous sûr de vouloir nettoyer le stockage ? Cette action supprimera les fichiers temporaires et orphelins.')) {
      console.log('Cleaning up storage...');
      // TODO: Implement storage cleanup
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-1/3"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            État du système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Base de données
                </span>
                {systemInfo && getStatusBadge(systemInfo.database_status)}
              </div>
              <p className="text-sm text-muted-foreground">PostgreSQL 15 via Supabase</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Stockage
                </span>
                {systemInfo && getStatusBadge(systemInfo.storage_status)}
              </div>
              <p className="text-sm text-muted-foreground">
                {systemInfo && `${systemInfo.storage_used_gb}GB / ${systemInfo.storage_total_gb}GB utilisés`}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  API
                </span>
                {systemInfo && getStatusBadge(systemInfo.api_status)}
              </div>
              <p className="text-sm text-muted-foreground">Next.js 15 sur Vercel</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium">Version</p>
              <p className="text-lg font-bold">{systemInfo?.version}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Temps de fonctionnement</p>
              <p className="text-lg font-bold">{systemInfo?.uptime}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Dernière sauvegarde</p>
              <p className="text-sm">{systemInfo && formatDate(systemInfo.last_backup)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Gestion de la base de données
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Outils de maintenance et d'optimisation de la base de données.
            </p>
            
            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                onClick={handleBackupDatabase}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Sauvegarder maintenant
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleOptimizeDatabase}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Optimiser les performances
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => fetchSystemInfo()}
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Actualiser les métriques
              </Button>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Les sauvegardes automatiques ont lieu chaque jour à 02:00 UTC. 
                Les données sont conservées pendant 30 jours.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Storage Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Gestion du stockage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Utilisation du stockage</span>
                <span>{systemInfo && `${systemInfo.storage_used_gb}GB / ${systemInfo.storage_total_gb}GB`}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: systemInfo ? `${(systemInfo.storage_used_gb / systemInfo.storage_total_gb) * 100}%` : '0%' 
                  }}
                ></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                onClick={handleCleanupStorage}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Nettoyer les fichiers temporaires
              </Button>
              
              <Button 
                variant="outline" 
                disabled
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Exporter les documents (bientôt)
              </Button>
            </div>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Le nettoyage automatique des fichiers temporaires a lieu chaque semaine. 
                Seuls les fichiers non référencés depuis plus de 7 jours sont supprimés.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* System Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paramètres de configuration avancés du système.
            </p>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Limites de stockage</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Taille maximale par fichier: 10MB
                </p>
                <p className="text-sm text-muted-foreground">
                  Stockage total disponible: 100GB
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Rétention des données</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Logs système: 90 jours
                </p>
                <p className="text-sm text-muted-foreground">
                  Fichiers temporaires: 7 jours
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Sécurité</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Authentification 2FA: Activée
                </p>
                <p className="text-sm text-muted-foreground">
                  Chiffrement: AES-256
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Performance</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Cache CDN: Activé
                </p>
                <p className="text-sm text-muted-foreground">
                  Compression: Gzip/Brotli
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}