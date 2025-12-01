'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobal } from '@/lib/context/GlobalContext';
import { useBanking } from '@/features/banking/hooks/useBanking';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function BankingCallbackPage() {
    const router = useRouter();
    const { user, selectedHouseholdId } = useGlobal();
    const { syncBankingData, error, loading, setError } = useBanking();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const handleCallback = async () => {
            try {
                if (!user?.id || !selectedHouseholdId) {
                    throw new Error('Utilisateur ou foyer non identifié');
                }

                // Vérifier si on a les données Bridge stockées
                const bridgeDataString = localStorage.getItem('bridgeUserData');
                if (!bridgeDataString) {
                    throw new Error('Aucune donnée de connexion trouvée');
                }

                const bridgeData = JSON.parse(bridgeDataString);

                // Sauvegarder les données utilisateur avec la date de connexion
                const bridgeUserData = {
                    ...bridgeData,
                    connectedAt: new Date().toISOString(),
                };

                const storageKey = `bridge_user_${user.id}_${selectedHouseholdId}`;
                localStorage.setItem(storageKey, JSON.stringify(bridgeUserData));

                // Nettoyer les données temporaires
                localStorage.removeItem('bridgeUserData');

                // Synchroniser les données bancaires
                await syncBankingData();

                setStatus('success');
                setMessage('Votre banque a été connectée avec succès !');

                // Redirection automatique après 2 secondes
                setTimeout(() => {
                    router.push('/app/banking');
                }, 2000);

            } catch (error: any) {
                console.error('Banking callback error:', error);
                setStatus('error');
                setMessage(error.message || 'Erreur lors de la finalisation de la connexion');
                setError(error.message);
            }
        };

        handleCallback();
    }, [user, selectedHouseholdId, syncBankingData, router, setError]);

    const handleRetry = () => {
        router.push('/app/banking');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        {status === 'loading' && (
                            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                        )}
                        {status === 'success' && (
                            <CheckCircle className="h-12 w-12 text-green-600" />
                        )}
                        {status === 'error' && (
                            <XCircle className="h-12 w-12 text-red-600" />
                        )}
                    </div>
                    <CardTitle>
                        {status === 'loading' && 'Finalisation de la connexion...'}
                        {status === 'success' && 'Connexion réussie !'}
                        {status === 'error' && 'Erreur de connexion'}
                    </CardTitle>
                    <CardDescription>
                        {status === 'loading' && 'Nous récupérons vos données bancaires de manière sécurisée.'}
                        {status === 'success' && 'Redirection vers vos comptes en cours...'}
                        {status === 'error' && 'Une erreur est survenue lors de la connexion.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {status === 'loading' && (
                        <div className="space-y-2">
                            <div className="text-sm text-muted-foreground text-center">
                                Synchronisation de vos comptes et transactions...
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full animate-pulse w-2/3"></div>
                            </div>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="text-center space-y-4">
                            <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                                {message}
                            </div>
                            <Button
                                onClick={() => router.push('/app/banking')}
                                className="w-full"
                            >
                                Voir mes comptes
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="space-y-4">
                            {(error || message) && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error || message}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-2">
                                <Button
                                    onClick={handleRetry}
                                    className="w-full"
                                    variant="outline"
                                >
                                    Retourner à la page Banking
                                </Button>
                                <Button
                                    onClick={() => router.push('/app')}
                                    variant="ghost"
                                    className="w-full"
                                >
                                    Retour au tableau de bord
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}