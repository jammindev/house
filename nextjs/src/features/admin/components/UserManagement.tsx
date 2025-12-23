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

            const params = new URLSearchParams();
            if (searchTerm.trim().length > 0) {
                params.set('search', searchTerm.trim());
            }

            const response = await fetch(`/api/admin/users${params.toString() ? `?${params.toString()}` : ''}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error || 'Impossible de charger les utilisateurs');
            }

            setUsers((payload?.users as UserWithStats[]) || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(err instanceof Error ? err.message : 'Erreur lors du chargement des utilisateurs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredUsers = users.filter(user =>
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
