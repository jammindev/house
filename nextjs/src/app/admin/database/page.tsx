// Database monitoring and logs page
import { AdminHeader } from '@/features/admin/components/AdminNav';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Activity, AlertTriangle } from 'lucide-react';

export default function AdminDatabasePage() {
  return (
    <div className="flex-1">
      <AdminHeader 
        title="Base de données" 
        description="Monitoring et maintenance de la base de données"
      />
      <div className="p-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                État de la base de données
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Connexions actives</span>
                    <Badge variant="secondary">23</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Sur 100 max</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Taille totale</span>
                    <Badge variant="secondary">1.2 GB</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">+15MB cette semaine</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Requêtes/min</span>
                    <Badge variant="secondary">156</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Moyenne sur 1h</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Temps réponse</span>
                    <Badge variant="secondary">12ms</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Moyenne sur 24h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Sauvegarde quotidienne réussie</p>
                    <p className="text-xs text-muted-foreground">Il y a 2 heures</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Optimisation des index terminée</p>
                    <p className="text-xs text-muted-foreground">Il y a 6 heures</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Pic de connexions détecté</p>
                    <p className="text-xs text-muted-foreground">Hier à 14:30</p>
                  </div>
                </div>
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
                <p className="text-sm">Les outils de monitoring avancé seront disponibles dans une prochaine version.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}