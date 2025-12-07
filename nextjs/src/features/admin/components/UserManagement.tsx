// User management component for admin
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, Search, UserPlus, Shield, ShieldCheck, Mail, 
  Calendar, Home, FileText, MoreHorizontal, Ban, CheckCircle
} from 'lucide-react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { AdminBadge } from './AdminGuard';
import { UserWithStats } from '../types';

export function UserManagement() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const supabase = await createSPASassClientAuthenticated();
      const client = supabase.getSupabaseClient();

      // Get all users with stats
      // Note: This would normally require service-role access
      // For now, we'll show placeholder data
      const mockUsers: UserWithStats[] = [
        {
          id: '1',
          email: 'admin@example.com',
          display_name: 'Administrateur Principal',
          created_at: '2024-01-01T00:00:00Z',
          last_sign_in_at: '2024-12-07T10:00:00Z',
          email_confirmed_at: '2024-01-01T00:00:00Z',
          households_count: 2,
          interactions_count: 45,
          is_admin: true,
          admin_role: 'super_admin'
        },
        {
          id: '2',
          email: 'user@example.com',
          display_name: 'Utilisateur Test',
          created_at: '2024-06-15T00:00:00Z',
          last_sign_in_at: '2024-12-06T14:30:00Z',
          email_confirmed_at: '2024-06-15T00:00:00Z',
          households_count: 1,
          interactions_count: 23,
          is_admin: false
        }
      ];

      // TODO: Replace with real query when service-role endpoint is available
      // const { data, error: usersError } = await client
      //   .from('auth.users')
      //   .select(`
      //     id, email, created_at, last_sign_in_at, email_confirmed_at,
      //     raw_user_meta_data,
      //     households:household_members(count),
      //     interactions(count)
      //   `);

      setUsers(mockUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.display_name && user.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Jamais';
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const handleGrantAdmin = async (userId: string) => {
    // TODO: Implement admin role granting
    console.log('Grant admin to user:', userId);
  };

  const handleRevokeAdmin = async (userId: string) => {
    // TODO: Implement admin role revoking
    console.log('Revoke admin from user:', userId);
  };

  const handleBanUser = async (userId: string) => {
    // TODO: Implement user banning
    console.log('Ban user:', userId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestion des utilisateurs
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {filteredUsers.length} utilisateur(s) affiché(s) sur {users.length} total
              </p>
            </div>
            <Button className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Inviter un utilisateur
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par email ou nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Foyers</TableHead>
                  <TableHead>Interactions</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {(user.display_name || user.email)[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{user.display_name || 'Sans nom'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.email_confirmed_at ? (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Confirmé
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            En attente
                          </Badge>
                        )}
                        {user.is_admin && <AdminBadge role={user.admin_role!} />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{user.households_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{user.interactions_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDate(user.created_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{formatDate(user.last_sign_in_at)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!user.is_admin ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleGrantAdmin(user.id)}
                            className="flex items-center gap-1"
                          >
                            <Shield className="h-3 w-3" />
                            Admin
                          </Button>
                        ) : user.admin_role !== 'super_admin' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRevokeAdmin(user.id)}
                            className="flex items-center gap-1"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Retirer
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleBanUser(user.id)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Ban className="h-3 w-3" />
                          Bannir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? 'Aucun utilisateur trouvé pour cette recherche' : 'Aucun utilisateur trouvé'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}