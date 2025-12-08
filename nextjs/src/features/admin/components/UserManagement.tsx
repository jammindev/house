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

            // Récupérer les utilisateurs via les tables accessibles
            // On ne peut pas accéder directement à auth.users, donc on utilise les household_members
            const { data: members, error: membersError } = await client
                .from('household_members')
                .select(`
                    user_id,
                    households(id, name)
                `);

            if (membersError) throw membersError;

            // Récupérer les admins système
            const { data: admins, error: adminsError } = await client
                .from('system_admins')
                .select('user_id, role');

            if (adminsError) throw adminsError;

            // Agréger les données par utilisateur
            const userStats = new Map<string, { households_count: number; is_admin: boolean; admin_role?: string }>();

            members?.forEach(member => {
                const userId = member.user_id;
                if (!userStats.has(userId)) {
                    userStats.set(userId, { households_count: 0, is_admin: false });
                }
                userStats.get(userId)!.households_count++;
            });

            admins?.forEach(admin => {
                if (!userStats.has(admin.user_id)) {
                    userStats.set(admin.user_id, { households_count: 0, is_admin: false });
                }
                userStats.get(admin.user_id)!.is_admin = true;
                userStats.get(admin.user_id)!.admin_role = admin.role;
            });

            // Créer des utilisateurs fictifs avec les stats réelles pour la démo
            const mockUsers: UserWithStats[] = Array.from(userStats.entries()).map(([userId, stats], index) => ({
                id: userId,
                email: `user${index + 1}@example.com`,
                display_name: `Utilisateur ${index + 1}`,
                created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
                last_sign_in_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                email_confirmed_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
                households_count: stats.households_count,
                interactions_count: Math.floor(Math.random() * 50) + 1,
                is_admin: stats.is_admin,
                admin_role: (stats.admin_role as 'admin' | 'super_admin') || undefined
            }));

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