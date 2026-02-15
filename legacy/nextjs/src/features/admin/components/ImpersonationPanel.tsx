// Admin impersonation control panel
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClientAuthenticated } from "@/lib/supabase/client";
import {
    clearImpersonationState,
    IMPERSONATION_EVENT,
    readImpersonationOrigin,
    readImpersonationTarget,
    saveImpersonationOrigin,
    saveImpersonationTarget,
    type StoredImpersonationOrigin,
    type StoredImpersonationTarget,
} from "../lib/impersonationStorage";
import { useAdminContext } from "../hooks/useAdmin";
import {
    AlertTriangle,
    ArrowLeftRight,
    Loader2,
    LogIn,
    RefreshCw,
    Search,
    ShieldOff,
    UserCheck2,
    UserCog,
    Users,
} from "lucide-react";

type ImpersonationUser = {
    id: string;
    email: string | null;
    display_name?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
};

export function ImpersonationPanel() {
    const { user, refreshUser } = useGlobal();
    const { refresh: refreshAdmin } = useAdminContext();

    const [search, setSearch] = useState("");
    const [users, setUsers] = useState<ImpersonationUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
    const [originSession, setOriginSession] = useState<StoredImpersonationOrigin | null>(null);
    const [target, setTarget] = useState<StoredImpersonationTarget | null>(null);

    const currentUserLabel = useMemo(() => user?.displayName || user?.email || "Utilisateur", [user?.displayName, user?.email]);

    const syncImpersonationState = useCallback(() => {
        setOriginSession(readImpersonationOrigin());
        setTarget(readImpersonationTarget());
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setActionError(null);

            const params = new URLSearchParams();
            if (search.trim().length > 0) {
                params.set("search", search.trim());
            }

            const response = await fetch(`/api/admin/impersonate${params.toString() ? `?${params.toString()}` : ""}`);
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || "Impossible de charger les utilisateurs");
            }

            setUsers(payload.users || []);
        } catch (error) {
            console.error("Failed to load users", error);
            setActionError(error instanceof Error ? error.message : "Impossible de charger les utilisateurs");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        syncImpersonationState();
        const handler = () => syncImpersonationState();
        window.addEventListener(IMPERSONATION_EVENT, handler);
        return () => window.removeEventListener(IMPERSONATION_EVENT, handler);
    }, [syncImpersonationState]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers();
        }, 250);
        return () => clearTimeout(timer);
    }, [fetchUsers]);

    const handleImpersonate = useCallback(
        async (targetUser: ImpersonationUser) => {
            setActionError(null);
            setLoadingUserId(targetUser.id);

            try {
                const supa = await createSPASassClientAuthenticated();
                const client = supa.getSupabaseClient();

                if (!readImpersonationOrigin()) {
                    const currentSession = await client.auth.getSession();
                    const session = currentSession?.data?.session;
                    if (session) {
                        saveImpersonationOrigin({
                            access_token: session.access_token,
                            refresh_token: session.refresh_token,
                            email: session.user?.email ?? null,
                            user_id: (session.user as any)?.id ?? null,
                        });
                        syncImpersonationState();
                    }
                }

                const response = await fetch("/api/admin/impersonate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: targetUser.id }),
                });

                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || "Impossible de générer la session");
                }

                const { tokenHash, email } = payload as { tokenHash: string; email: string };

                const { error } = await client.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: "magiclink",
                });

                if (error) {
                    throw new Error(error.message);
                }

                saveImpersonationTarget({
                    id: targetUser.id,
                    email: email ?? targetUser.email ?? null,
                    display_name: targetUser.display_name ?? undefined,
                });
                syncImpersonationState();
                await refreshUser();
                await refreshAdmin();
            } catch (error) {
                console.error("Failed to impersonate user", error);
                setActionError(error instanceof Error ? error.message : "Échec de l'impersonation");
            } finally {
                setLoadingUserId(null);
            }
        },
        [refreshUser, syncImpersonationState],
    );

    const handleStopImpersonation = useCallback(async () => {
        const origin = readImpersonationOrigin();
        if (!origin) {
            setActionError("Session administrateur initiale introuvable");
            return;
        }

        try {
            setLoadingUserId("restore");
            const supa = await createSPASassClientAuthenticated();
            const client = supa.getSupabaseClient();

            const { error } = await client.auth.setSession({
                access_token: origin.access_token,
                refresh_token: origin.refresh_token,
            });

            if (error) {
                throw new Error(error.message);
            }

            clearImpersonationState();
            syncImpersonationState();
            await refreshUser();
            await refreshAdmin();
        } catch (error) {
            console.error("Failed to restore admin session", error);
            setActionError(error instanceof Error ? error.message : "Impossible de revenir sur le compte admin");
        } finally {
            setLoadingUserId(null);
        }
    }, [refreshUser, syncImpersonationState]);

    const formatDate = (value?: string | null) => {
        if (!value) return "—";
        return new Intl.DateTimeFormat("fr-FR", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value));
    };

    return (
        <div className="space-y-6">
            {originSession && (
                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="gap-1">
                                <ArrowLeftRight className="h-3 w-3" />
                                Impersonation active
                            </Badge>
                            {target?.email && (
                                <span className="text-sm">
                                    Vous consultez le compte <strong>{target.email}</strong>
                                    {target.display_name ? ` (${target.display_name})` : ""}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleStopImpersonation}
                                disabled={loadingUserId === "restore"}
                                className="gap-2"
                            >
                                {loadingUserId === "restore" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                                Revenir sur mon compte admin
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5" />
                            Impersonation des comptes
                        </CardTitle>
                        <CardDescription>Se connecter temporairement en tant qu&apos;un autre utilisateur</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                            <UserCheck2 className="h-3 w-3" />
                            {currentUserLabel}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={fetchUsers} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-md">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filtrer par email ou nom..."
                                className="pl-8"
                            />
                        </div>
                        {actionError && (
                            <div className="text-sm text-red-600 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                {actionError}
                            </div>
                        )}
                    </div>

                    <div className="border rounded-md overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Utilisateur</TableHead>
                                    <TableHead>Dernière connexion</TableHead>
                                    <TableHead>Créé le</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Chargement des utilisateurs...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <Users className="h-6 w-6" />
                                                Aucun utilisateur trouvé
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((u) => {
                                        const isCurrentTarget = target?.id === u.id;

                                        return (
                                            <TableRow key={u.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{u.display_name || "Sans nom"}</span>
                                                        <span className="text-sm text-muted-foreground">{u.email ?? "Email inconnu"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatDate(u.last_sign_in_at)}</TableCell>
                                                <TableCell>{formatDate(u.created_at)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {isCurrentTarget && (
                                                            <Badge variant="secondary" className="gap-1">
                                                                <ArrowLeftRight className="h-3 w-3" />
                                                                Actif
                                                            </Badge>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="gap-2"
                                                            disabled={loadingUserId === u.id}
                                                            onClick={() => handleImpersonate(u)}
                                                        >
                                                            {loadingUserId === u.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <LogIn className="h-4 w-4" />
                                                            )}
                                                            Utiliser ce compte
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
