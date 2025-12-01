'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ResourcePageShell from '@shared/layout/ResourcePageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, CreditCard, ArrowLeft, RefreshCw } from 'lucide-react';
import type { BridgeAccount, BridgeTransaction } from '@/lib/bridge';

interface BridgeUserData {
    appUserId: string;
    email: string;
    bridgeUserUuid: string;
}

export default function BankingCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<BridgeAccount[]>([]);
    const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
    const [error, setError] = useState('');
    const [userData, setUserData] = useState<BridgeUserData | null>(null);
    const [accessToken, setAccessToken] = useState('');

    useEffect(() => {
        // Get user data from localStorage
        const storedData = localStorage.getItem('bridgeUserData');
        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                setUserData(parsed);
            } catch (error) {
                console.error('Failed to parse stored user data:', error);
            }
        }

        // Check for success/error parameters from Bridge
        const status = searchParams.get('status');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            setError(`Erreur de connexion: ${errorParam}`);
        } else if (status === 'success' || !status) {
            // Connection successful, fetch data
            fetchBankingData();
        }
    }, [searchParams]);

    const fetchBankingData = async () => {
        if (!userData?.bridgeUserUuid) {
            setError('Données utilisateur manquantes');
            return;
        }

        setLoading(true);
        setError('');

        try {
            console.log('Fetching banking data for user:', userData.bridgeUserUuid);

            // Get fresh access token
            const tokenRes = await fetch('/api/bridge/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bridgeUserUuid: userData.bridgeUserUuid }),
            });

            if (!tokenRes.ok) {
                throw new Error('Impossible de récupérer le token d\'accès');
            }

            const tokenData = await tokenRes.json();
            setAccessToken(tokenData.accessToken);

            // Fetch accounts
            const accountsRes = await fetch('/api/bridge/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: tokenData.accessToken }),
            });

            if (!accountsRes.ok) {
                throw new Error('Impossible de récupérer les comptes');
            }

            const accountsData = await accountsRes.json();
            setAccounts(accountsData.accounts || []);

            // Fetch recent transactions (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const transactionsRes = await fetch('/api/bridge/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessToken: tokenData.accessToken,
                    since: thirtyDaysAgo.toISOString().split('T')[0],
                    limit: 50,
                }),
            });

            if (!transactionsRes.ok) {
                throw new Error('Impossible de récupérer les transactions');
            }

            const transactionsData = await transactionsRes.json();
            setTransactions(transactionsData.transactions || []);

            console.log('Banking data loaded:', {
                accounts: accountsData.accounts?.length || 0,
                transactions: transactionsData.transactions?.length || 0,
            });
        } catch (error: any) {
            console.error('Failed to fetch banking data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatAmount = (amount: number, currency: string = 'EUR') => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency,
        }).format(amount);
    };

    const getAccountStatusBadge = (statusCode: number) => {
        switch (statusCode) {
            case 0:
                return <Badge variant="default">Actif</Badge>;
            case -1:
                return <Badge variant="destructive">Erreur</Badge>;
            default:
                return <Badge variant="secondary">Inconnu</Badge>;
        }
    };

    if (error) {
        return (
            <ResourcePageShell
                title="Erreur de connexion"
                subtitle="Une erreur s'est produite lors de la connexion bancaire"
                hideBackButton={false}
            >
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="ml-2">{error}</AlertDescription>
                </Alert>
                <div className="mt-4 text-center">
                    <Button onClick={() => router.push('/app/banking')} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour
                    </Button>
                </div>
            </ResourcePageShell>
        );
    }

    return (
        <ResourcePageShell
            title="Connexion réussie !"
            subtitle="Vos comptes bancaires ont été connectés avec succès"
            hideBackButton={false}
            bodyClassName="space-y-8"
        >
            <div className="space-y-8">
                {/* Success Header */}
                <div className="text-center">
                    <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                </div>

                {/* User Info */}
                {userData && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Informations de connexion</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-medium">Email:</span> {userData.email}
                                </div>
                                <div>
                                    <span className="font-medium">ID utilisateur:</span> {userData.appUserId}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-8">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                        <p className="mt-2 text-muted-foreground">Chargement de vos données bancaires...</p>
                    </div>
                )}

                {/* Accounts */}
                {!loading && accounts.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold">Vos comptes ({accounts.length})</h2>
                            <Button onClick={fetchBankingData} variant="outline" size="sm">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Actualiser
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {accounts.map((account) => (
                                <Card key={account.id}>
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{account.name}</CardTitle>
                                                <CardDescription>{account.bank.name}</CardDescription>
                                            </div>
                                            {getAccountStatusBadge(account.status)}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="text-2xl font-bold">
                                                {formatAmount(account.balance, account.currency_code)}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                Type: {account.type}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                Mis à jour: {new Date(account.updated_at).toLocaleDateString('fr-FR')}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Transactions */}
                {!loading && transactions.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold">Transactions récentes ({transactions.length})</h2>
                        <Card>
                            <CardContent className="p-0">
                                <div className="space-y-0">
                                    {transactions.slice(0, 10).map((transaction) => (
                                        <div key={transaction.id} className="flex items-center justify-between p-4 border-b last:border-b-0">
                                            <div className="flex items-center space-x-3">
                                                <CreditCard className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{transaction.description}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {transaction.account.name} • {new Date(transaction.date).toLocaleDateString('fr-FR')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {formatAmount(transaction.amount, transaction.currency_code)}
                                                </p>
                                                {transaction.category && (
                                                    <p className="text-xs text-muted-foreground">{transaction.category.name}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                        {transactions.length > 10 && (
                            <p className="text-center text-muted-foreground">
                                ... et {transactions.length - 10} autres transactions
                            </p>
                        )}
                    </div>
                )}

                {/* No Data State */}
                {!loading && accounts.length === 0 && !error && (
                    <Card>
                        <CardContent className="text-center py-8">
                            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Aucune donnée disponible</h3>
                            <p className="text-muted-foreground mb-4">
                                Il semblerait qu'aucun compte n'ait été trouvé ou que la synchronisation soit en cours.
                            </p>
                            <Button onClick={fetchBankingData}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Réessayer
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <div className="flex justify-center space-x-4">
                    <Button onClick={() => router.push('/app')} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Retour au tableau de bord
                    </Button>
                    <Button onClick={() => router.push('/app/banking')}>
                        Connecter une autre banque
                    </Button>
                </div>
            </div>
        </ResourcePageShell>
    );
}