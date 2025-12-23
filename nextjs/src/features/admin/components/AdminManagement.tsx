// Admin management component for super admins
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    ShieldCheck, Shield, UserPlus, Search, Crown,
    Calendar, Mail, Trash2, AlertTriangle
} from 'lucide-react';
import { SystemAdmin } from '../types';
import { AdminGuard, AdminBadge } from './AdminGuard';

export function AdminManagement() {
    const [admins, setAdmins] = useState<SystemAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAdminEmail, setNewAdminEmail] = useState('');
    const [newAdminRole, setNewAdminRole] = useState<'admin' | 'super_admin'>('admin');
    const [newAdminNotes, setNewAdminNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/system-admins', { cache: 'no-store' });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || 'Impossible de charger les administrateurs');
            }

            const payload = await response.json();
            const admins = payload?.admins as SystemAdmin[] | undefined;

            if (!admins) {
                setAdmins([]);
                return;
            }

            setAdmins(admins);
        } catch (err) {
            console.error('Error fetching admins:', err);
            setError(err instanceof Error ? err.message : 'Erreur lors du chargement des administrateurs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    const filteredAdmins = admins.filter(admin =>
        (admin.user_email && admin.user_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (admin.user_display_name && admin.user_display_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleGrantAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            // TODO: Implement admin role granting
            console.log('Grant admin role:', {
                email: newAdminEmail,
                role: newAdminRole,
                notes: newAdminNotes
            });

            // Reset form
            setNewAdminEmail('');
            setNewAdminRole('admin');
            setNewAdminNotes('');
            setShowAddForm(false);

            // Refresh admins list
            await fetchAdmins();
        } catch (err) {
            console.error('Error granting admin role:', err);
            setError(err instanceof Error ? err.message : 'Erreur lors de l\'attribution du rôle');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevokeAdmin = async (adminId: string) => {
        if (!confirm('Êtes-vous sûr de vouloir révoquer les privilèges administrateur de cet utilisateur ?')) {
            return;
        }

        try {
            // TODO: Implement admin role revocation
            console.log('Revoke admin role for:', adminId);
            await fetchAdmins();
        } catch (err) {
            console.error('Error revoking admin role:', err);
            setError(err instanceof Error ? err.message : 'Erreur lors de la révocation du rôle');
        }
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

    return (
        <AdminGuard requireSuperAdmin>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5" />
                                    Gestion des administrateurs
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    {filteredAdmins.length} administrateur(s) affiché(s) sur {admins.length} total
                                </p>
                            </div>
                            <Button
                                onClick={() => setShowAddForm(!showAddForm)}
                                className="flex items-center gap-2"
                            >
                                <UserPlus className="h-4 w-4" />
                                Ajouter un admin
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Add admin form */}
                        {showAddForm && (
                            <Card className="mb-6">
                                <CardContent className="p-4">
                                    <form onSubmit={handleGrantAdmin} className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <label className="text-sm font-medium">Email de l'utilisateur</label>
                                                <Input
                                                    type="email"
                                                    value={newAdminEmail}
                                                    onChange={(e) => setNewAdminEmail(e.target.value)}
                                                    placeholder="utilisateur@example.com"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Rôle</label>
                                                <select
                                                    value={newAdminRole}
                                                    onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'super_admin')}
                                                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                                                >
                                                    <option value="admin">Administrateur</option>
                                                    <option value="super_admin">Super Administrateur</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Notes (optionnel)</label>
                                            <Textarea
                                                value={newAdminNotes}
                                                onChange={(e) => setNewAdminNotes(e.target.value)}
                                                placeholder="Raison de l'attribution du rôle, responsabilités..."
                                                rows={2}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button type="submit" disabled={submitting}>
                                                {submitting ? 'Ajout en cours...' : 'Ajouter l\'administrateur'}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setShowAddForm(false)}
                                            >
                                                Annuler
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        )}

                        {/* Search */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher un administrateur..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        {error && (
                            <Alert className="mb-4">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {loading ? (
                            <div className="animate-pulse space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-16 bg-muted rounded"></div>
                                ))}
                            </div>
                        ) : (
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Administrateur</TableHead>
                                            <TableHead>Rôle</TableHead>
                                            <TableHead>Accordé par</TableHead>
                                            <TableHead>Date d'attribution</TableHead>
                                            <TableHead>Notes</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredAdmins.map((admin) => (
                                            <TableRow key={admin.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                                            <Shield className="h-4 w-4 text-red-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">{admin.user_display_name || 'Sans nom'}</p>
                                                            <p className="text-sm text-muted-foreground">{admin.user_email}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <AdminBadge role={admin.role} />
                                                    {admin.role === 'super_admin' && (
                                                        <Crown className="h-3 w-3 text-yellow-600 ml-2 inline" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm">{admin.granted_by || 'Système'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">{formatDate(admin.granted_at)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">
                                                        {admin.notes || 'Aucune note'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {admin.role !== 'super_admin' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRevokeAdmin(admin.id)}
                                                            className="flex items-center gap-1 text-red-600 hover:text-red-700"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                            Révoquer
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {filteredAdmins.length === 0 && !loading && (
                            <div className="text-center py-8">
                                <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">
                                    {searchTerm ? 'Aucun administrateur trouvé pour cette recherche' : 'Aucun administrateur trouvé'}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminGuard>
    );
}
