// Main admin dashboard component
"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSystemStats } from '../hooks/useAdmin';
import {
    Users, Home, FileText, FolderTree, FileImage, Briefcase,
    Settings, Activity, Database, HardDrive, TrendingUp, Calendar,
    Shield, UserCheck
} from 'lucide-react';
import Link from 'next/link';

interface StatCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon: React.ReactNode;
    trend?: {
        value: number;
        label: string;
        isPositive?: boolean;
    };
}

function StatCard({ title, value, description, icon, trend }: StatCardProps) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-2xl font-bold">{value}</p>
                        {description && (
                            <p className="text-xs text-muted-foreground">{description}</p>
                        )}
                    </div>
                    <div className="text-muted-foreground">{icon}</div>
                </div>
                {trend && (
                    <div className="mt-4 flex items-center gap-1">
                        <Badge variant={trend.isPositive ? "default" : "secondary"} className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {trend.value > 0 ? '+' : ''}{trend.value}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{trend.label}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function AdminDashboard() {
    const { stats, loading, error } = useSystemStats();

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(8)].map((_, i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="space-y-2">
                                    <div className="h-4 bg-muted rounded w-3/4"></div>
                                    <div className="h-8 bg-muted rounded w-1/2"></div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-6">
                    <p className="text-red-600">Erreur lors du chargement des statistiques: {error}</p>
                </CardContent>
            </Card>
        );
    }

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('fr-FR').format(num);
    };

    const formatStorage = (mb: number) => {
        if (mb < 1024) return `${mb.toFixed(1)} MB`;
        return `${(mb / 1024).toFixed(1)} GB`;
    };

    return (
        <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Administration système
                            </CardTitle>
                            <CardDescription>
                                Gérez votre application House depuis cette interface d'administration
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Link href="/admin/users">
                            <Button variant="outline" className="h-auto p-4 justify-start w-full">
                                <div className="flex items-center gap-3">
                                    <Users className="h-5 w-5" />
                                    <div className="text-left">
                                        <p className="font-medium">Utilisateurs</p>
                                        <p className="text-sm text-muted-foreground">Gérer les comptes</p>
                                    </div>
                                </div>
                            </Button>
                        </Link>
                        <Link href="/admin/households">
                            <Button variant="outline" className="h-auto p-4 justify-start w-full">
                                <div className="flex items-center gap-3">
                                    <Home className="h-5 w-5" />
                                    <div className="text-left">
                                        <p className="font-medium">Foyers</p>
                                        <p className="text-sm text-muted-foreground">Gérer les foyers</p>
                                    </div>
                                </div>
                            </Button>
                        </Link>
                        <Link href="/admin/admins">
                            <Button variant="outline" className="h-auto p-4 justify-start w-full">
                                <div className="flex items-center gap-3">
                                    <UserCheck className="h-5 w-5" />
                                    <div className="text-left">
                                        <p className="font-medium">Admins</p>
                                        <p className="text-sm text-muted-foreground">Gérer les admins</p>
                                    </div>
                                </div>
                            </Button>
                        </Link>
                        <Link href="/admin/system">
                            <Button variant="outline" className="h-auto p-4 justify-start w-full">
                                <div className="flex items-center gap-3">
                                    <Settings className="h-5 w-5" />
                                    <div className="text-left">
                                        <p className="font-medium">Système</p>
                                        <p className="text-sm text-muted-foreground">Configuration</p>
                                    </div>
                                </div>
                            </Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* System Statistics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Utilisateurs totaux"
                    value={formatNumber(stats?.total_users || 0)}
                    description="Comptes créés"
                    icon={<Users className="h-4 w-4" />}
                    trend={{
                        value: stats?.active_users_last_30_days || 0,
                        label: "actifs (30j)",
                        isPositive: true
                    }}
                />

                <StatCard
                    title="Foyers"
                    value={formatNumber(stats?.total_households || 0)}
                    description="Foyers créés"
                    icon={<Home className="h-4 w-4" />}
                    trend={{
                        value: stats?.new_households_last_30_days || 0,
                        label: "nouveaux (30j)",
                        isPositive: true
                    }}
                />

                <StatCard
                    title="Interactions"
                    value={formatNumber(stats?.total_interactions || 0)}
                    description="Entrées créées"
                    icon={<FileText className="h-4 w-4" />}
                />

                <StatCard
                    title="Zones"
                    value={formatNumber(stats?.total_zones || 0)}
                    description="Zones définies"
                    icon={<FolderTree className="h-4 w-4" />}
                />

                <StatCard
                    title="Documents"
                    value={formatNumber(stats?.total_documents || 0)}
                    description="Fichiers stockés"
                    icon={<FileImage className="h-4 w-4" />}
                />

                <StatCard
                    title="Projets"
                    value={formatNumber(stats?.total_projects || 0)}
                    description="Projets créés"
                    icon={<Briefcase className="h-4 w-4" />}
                />

                <StatCard
                    title="Équipements"
                    value={formatNumber(stats?.total_equipment || 0)}
                    description="Équipements inventoriés"
                    icon={<Settings className="h-4 w-4" />}
                />

                <StatCard
                    title="Stockage"
                    value={formatStorage(stats?.storage_usage_mb || 0)}
                    description="Espace utilisé"
                    icon={<HardDrive className="h-4 w-4" />}
                />
            </div>

            {/* Recent Activity Summary */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Activité récente
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Derniers 30 jours</span>
                            </div>
                            <div className="pl-6 space-y-1">
                                <p className="text-sm">
                                    <span className="font-medium">{stats?.active_users_last_30_days || 0}</span> utilisateurs actifs
                                </p>
                                <p className="text-sm">
                                    <span className="font-medium">{stats?.new_households_last_30_days || 0}</span> nouveaux foyers
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Contenu</span>
                            </div>
                            <div className="pl-6 space-y-1">
                                <p className="text-sm">
                                    <span className="font-medium">{((stats?.total_interactions || 0) / (stats?.total_users || 1)).toFixed(1)}</span> interactions/utilisateur
                                </p>
                                <p className="text-sm">
                                    <span className="font-medium">{((stats?.total_zones || 0) / (stats?.total_households || 1)).toFixed(1)}</span> zones/foyer
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <HardDrive className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Stockage</span>
                            </div>
                            <div className="pl-6 space-y-1">
                                <p className="text-sm">
                                    <span className="font-medium">{((stats?.storage_usage_mb || 0) / (stats?.total_documents || 1)).toFixed(1)}</span> MB/document
                                </p>
                                <p className="text-sm">
                                    <span className="font-medium">{((stats?.total_documents || 0) / (stats?.total_interactions || 1) * 100).toFixed(1)}%</span> interactions avec fichiers
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}