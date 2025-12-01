'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useGlobal } from '@/lib/context/GlobalContext';
import { useBanking } from '@/features/banking/hooks/useBanking';
import ResourcePageShell from '@shared/layout/ResourcePageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Banknote, Shield, Download, ArrowRight, RefreshCw, LogOut, Eye, CreditCard } from 'lucide-react';
import type { PageAction } from '@/components/layout/AppPageLayout';

export default function BankingPage() {
    const { t } = useI18n();
    const { user, selectedHouseholdId } = useGlobal();
    const router = useRouter();
    const [email, setEmail] = useState(user?.email || '');
    
    const {
        loading,
        connecting,
        error,
        isConnected,
        bridgeUser,
        accounts,
        transactions,
        recentTransactions,
        balancesByCurrency,
        totalTransactions,
        connectToBank,
        syncBankingData,
        disconnectBank,
        cleanupOldConnections,
        setError,
    } = useBanking();

    const handleConnect = async () => {
        if (!email) {
            setError('Veuillez saisir votre email');
            return;
        }

        try {
            await connectToBank(email);
        } catch (error: any) {
            // Error is already set by the hook
            console.error('Banking connection error:', error);
        }
    };

    const handleSync = async () => {
        try {
            await syncBankingData();
        } catch (error: any) {
            // Error is already set by the hook
            console.error('Banking sync error:', error);
        }
    };

    const handleDisconnect = () => {
        disconnectBank();
        setEmail(user?.email || '');
    };

    // Si connecté, afficher les données bancaires
    if (isConnected) {
        const pageActions = useMemo<PageAction[]>(() => {
            return [
                {
                    element: (
                        <Button
                            onClick={handleSync}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Synchroniser
                        </Button>
                    ),
                },
                {
                    element: (
                        <Button
                            onClick={cleanupOldConnections}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Nettoyer
                        </Button>
                    ),
                },
                {
                    element: (
                        <Button
                            onClick={handleDisconnect}
                            variant="outline"
                            size="sm"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Déconnecter
                        </Button>
                    ),
                },
            ];
        }, [loading, handleSync, handleDisconnect]);

        return (
            <ResourcePageShell
                title="Mes comptes bancaires"
                subtitle={`${accounts.length} compte(s) connecté(s) • Dernière sync: ${bridgeUser?.connectedAt ? new Date(bridgeUser.connectedAt).toLocaleDateString('fr-FR') : 'N/A'}`}
                actions={pageActions}
                hideBackButton
                bodyClassName="space-y-6"
            >
                <div className="space-y-6">
                    {/* Error Alert */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Statistiques */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Soldes par devise</CardTitle>
                                <Banknote className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-1">
                                    {Object.entries(balancesByCurrency).map(([currency, balance]) => (
                                        <div key={currency} className="text-lg font-bold">
                                            {new Intl.NumberFormat('fr-FR', {
                                                style: 'currency',
                                                currency,
                                            }).format(balance)}
                                        </div>
                                    ))}
                                    {Object.keys(balancesByCurrency).length === 0 && (
                                        <div className="text-lg font-bold text-muted-foreground">--</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Comptes</CardTitle>
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{accounts.length}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Transactions (30j)</CardTitle>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalTransactions}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Comptes */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Mes comptes</h3>
                        {accounts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {accounts.map((account) => (
                                    <Card key={account.id}>
                                        <CardHeader>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-base">{account.name}</CardTitle>
                                                    <CardDescription>Demo Bank • {account.type}</CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-lg font-semibold">
                                                        {new Intl.NumberFormat('fr-FR', {
                                                            style: 'currency',
                                                            currency: account.currency_code,
                                                        }).format(account.balance)}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {account.type}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="text-center py-8">
                                    <p className="text-muted-foreground">Aucun compte trouvé</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Connectez votre banque pour voir vos comptes
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Transactions récentes */}
                    {recentTransactions.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Transactions récentes</h3>
                            <Card>
                                <CardContent className="p-0">
                                    <div className="space-y-0">
                                        {recentTransactions.map((transaction) => (
                                            <div
                                                key={transaction.id}
                                                className="flex items-center justify-between p-4 border-b last:border-b-0"
                                            >
                                                <div>
                                                    <div className="font-medium">{transaction.description}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {new Date(transaction.date).toLocaleDateString('fr-FR')} • {transaction.category?.name || 'Autre'}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`font-semibold ${transaction.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {new Intl.NumberFormat('fr-FR', {
                                                            style: 'currency',
                                                            currency: 'EUR',
                                                            signDisplay: 'always',
                                                        }).format(transaction.amount)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </ResourcePageShell>
        );
    }

    // Si pas connecté, afficher le formulaire de connexion
    const features = [
        {
            icon: Shield,
            title: 'Sécurisé et conforme',
            description: 'Connexion sécurisée via Bridge API, conforme DSP2',
        },
        {
            icon: Download,
            title: 'Synchronisation automatique',
            description: 'Récupération automatique de vos comptes et transactions',
        },
        {
            icon: Banknote,
            title: 'Toutes vos banques',
            description: 'Compatible avec la plupart des banques françaises',
        },
    ];

    const pageActions = useMemo<PageAction[]>(() => {
        return [
            {
                element: (
                    <Button
                        onClick={handleConnect}
                        disabled={connecting || !email}
                        size="lg"
                    >
                        {connecting ? (
                            'Redirection en cours...'
                        ) : (
                            <>
                                Connecter ma banque
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                ),
            },
        ];
    }, [connecting, email, handleConnect]);

    return (
        <ResourcePageShell
            title="Connexion bancaire"
            subtitle="Connectez vos comptes bancaires pour synchroniser automatiquement vos finances avec votre gestion de maison"
            actions={pageActions}
            hideBackButton
            bodyClassName="space-y-8"
        >
            <div className="space-y-8">
                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <Card key={index} className="text-center">
                            <CardHeader>
                                <feature.icon className="h-12 w-12 text-blue-600 mx-auto" />
                                <CardTitle className="text-lg">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{feature.description}</CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Connection Form */}
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle>Connecter vos comptes</CardTitle>
                        <CardDescription>
                            Saisissez votre email pour commencer la connexion sécurisée
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Adresse email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="votre@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={connecting}
                                required
                            />
                        </div>

                        <Button
                            onClick={handleConnect}
                            disabled={connecting || !email}
                            className="w-full"
                            size="lg"
                        >
                            {connecting ? (
                                'Redirection en cours...'
                            ) : (
                                <>
                                    Connecter ma banque
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                        
                        <div className="text-xs text-muted-foreground text-center mt-2">
                            💡 Après avoir connecté votre banque, revenez à cette page pour voir vos données
                        </div>

                        {/* Afficher un bouton de synchronisation si l'utilisateur a des données Bridge stockées */}
                        {bridgeUser && (
                            <div className="mt-4 pt-4 border-t">
                                <div className="text-sm text-muted-foreground mb-2 text-center">
                                    Vous avez déjà connecté votre banque ? Synchronisez vos données :
                                </div>
                                <Button
                                    onClick={handleSync}
                                    disabled={loading}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                    Synchroniser mes données
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Info */}
                <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                        🔒 Vos données bancaires sont sécurisées et jamais stockées sur nos serveurs
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Powered by Bridge API - Conforme DSP2
                    </p>
                </div>
            </div>
        </ResourcePageShell>
    );
}