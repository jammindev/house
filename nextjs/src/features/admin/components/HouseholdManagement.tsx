// Household management component for admin
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
    Home, Search, Plus, Users, FileText, FolderTree,
    Briefcase, Settings, Calendar, Mail, Trash2,
    MoreHorizontal, AlertTriangle
} from 'lucide-react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { HouseholdWithStats } from '../types';

export function HouseholdManagement() {
    const [households, setHouseholds] = useState<HouseholdWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fetchHouseholds = async () => {
        try {
            setLoading(true);
            const supabase = await createSPASassClientAuthenticated();
            const client = supabase.getSupabaseClient();

            // For now, show mock data until service-role access is implemented
            const mockHouseholds: HouseholdWithStats[] = [
                {
                    id: '1',
                    name: 'Maison Famille Dupont',
                    created_at: '2024-01-15T00:00:00Z',
                    members_count: 4,
                    interactions_count: 156,
                    zones_count: 12,
                    projects_count: 3,
                    documents_count: 89,
                    equipment_count: 23,
                    owner_email: 'dupont@example.com'
                },
                {
                    id: '2',
                    name: 'Appartement Centre Ville',
                    created_at: '2024-03-22T00:00:00Z',
                    members_count: 2,
                    interactions_count: 78,
                    zones_count: 7,
                    projects_count: 1,
                    documents_count: 34,
                    equipment_count: 15,
                    owner_email: 'martin@example.com'
                },
                {
                    id: '3',
                    name: 'Villa Bord de Mer',
                    created_at: '2024-06-10T00:00:00Z',
                    members_count: 3,
                    interactions_count: 203,
                    zones_count: 18,
                    projects_count: 5,
                    documents_count: 167,
                    equipment_count: 45,
                    owner_email: 'dubois@example.com'
                }
            ];

            // TODO: Replace with real query when service-role access is available
            // const { data, error: householdsError } = await client
            //   .from('households')
            //   .select(`
            //     id, name, created_at,
            //     household_members(count),
            //     interactions(count),
            //     zones(count),
            //     projects(count),
            //     documents(count),
            //     equipment(count)
            //   `);

            setHouseholds(mockHouseholds);
        } catch (err) {
            console.error('Error fetching households:', err);
            setError(err instanceof Error ? err.message : 'Erreur lors du chargement des foyers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHouseholds();
    }, []);

    const filteredHouseholds = households.filter(household =>
        household.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (household.owner_email && household.owner_email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(dateString));
    };

    const handleDeleteHousehold = async (householdId: string) => {
        // TODO: Implement household deletion with confirmation
        if (confirm('Êtes-vous sûr de vouloir supprimer ce foyer ? Cette action est irréversible.')) {
            console.log('Delete household:', householdId);
        }
    };

    const getTotalStats = () => {
        return households.reduce((acc, household) => ({
            members: acc.members + household.members_count,
            interactions: acc.interactions + household.interactions_count,
            zones: acc.zones + household.zones_count,
            projects: acc.projects + household.projects_count,
            documents: acc.documents + household.documents_count,
            equipment: acc.equipment + household.equipment_count,
        }), {
            members: 0,
            interactions: 0,
            zones: 0,
            projects: 0,
            documents: 0,
            equipment: 0
        });
    };

    const totalStats = getTotalStats();

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-muted rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Foyers</p>
                                <p className="text-2xl font-bold">{households.length}</p>
                            </div>
                            <Home className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Membres</p>
                                <p className="text-2xl font-bold">{totalStats.members}</p>
                            </div>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Interactions</p>
                                <p className="text-2xl font-bold">{totalStats.interactions}</p>
                            </div>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Zones</p>
                                <p className="text-2xl font-bold">{totalStats.zones}</p>
                            </div>
                            <FolderTree className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Projets</p>
                                <p className="text-2xl font-bold">{totalStats.projects}</p>
                            </div>
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-muted-foreground">Équipements</p>
                                <p className="text-2xl font-bold">{totalStats.equipment}</p>
                            </div>
                            <Settings className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Home className="h-5 w-5" />
                                Gestion des foyers
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                {filteredHouseholds.length} foyer(s) affiché(s) sur {households.length} total
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher par nom ou propriétaire..."
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
                                    <TableHead>Foyer</TableHead>
                                    <TableHead>Propriétaire</TableHead>
                                    <TableHead>Membres</TableHead>
                                    <TableHead>Contenu</TableHead>
                                    <TableHead>Créé le</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHouseholds.map((household) => (
                                    <TableRow key={household.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <Home className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{household.name}</p>
                                                    <p className="text-sm text-muted-foreground">ID: {household.id.slice(0, 8)}...</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm">{household.owner_email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                                <Users className="h-3 w-3" />
                                                {household.members_count}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-4 text-sm">
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="h-3 w-3 text-muted-foreground" />
                                                        {household.interactions_count}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <FolderTree className="h-3 w-3 text-muted-foreground" />
                                                        {household.zones_count}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                                                        {household.projects_count}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm">
                                                    <span className="flex items-center gap-1">
                                                        <FileText className="h-3 w-3 text-muted-foreground" />
                                                        {household.documents_count} docs
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Settings className="h-3 w-3 text-muted-foreground" />
                                                        {household.equipment_count} équip.
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-sm">{formatDate(household.created_at)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeleteHousehold(household.id)}
                                                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                    Supprimer
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {filteredHouseholds.length === 0 && (
                        <div className="text-center py-8">
                            <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">
                                {searchTerm ? 'Aucun foyer trouvé pour cette recherche' : 'Aucun foyer trouvé'}
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}