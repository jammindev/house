'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useGlobal } from '@/lib/context/GlobalContext';
import ResourcePageShell from '@shared/layout/ResourcePageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Banknote, Shield, Download, ArrowRight } from 'lucide-react';
import type { PageAction } from '@/components/layout/AppPageLayout';

export default function BankingPage() {
    const { t } = useI18n();
    const { user, selectedHouseholdId } = useGlobal();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState(user?.email || '');
    const [error, setError] = useState('');

    const handleConnect = async () => {
        setLoading(true);
        setError('');

        try {
            if (!email) {
                setError('Veuillez saisir votre email');
                return;
            }

            if (!user?.id) {
                setError('Utilisateur non authentifié');
                return;
            }

            console.log('Starting bank connection process...');

            const res = await fetch('/api/bridge/create-connect-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appUserId: user.id,
                    email,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Échec de la connexion');
            }

            const data = await res.json();
            console.log('Redirect URL received:', data.redirectUrl);

            // Store user info in localStorage for callback page
            localStorage.setItem('bridgeUserData', JSON.stringify({
                appUserId: user.id,
                email,
                bridgeUserUuid: data.bridgeUserUuid,
            }));

            // Redirect to Bridge Connect
            window.location.href = data.redirectUrl;
        } catch (error: any) {
            console.error('Banking connection error:', error);
            setError(error.message || 'Impossible de démarrer la connexion bancaire');
        } finally {
            setLoading(false);
        }
    };

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
                        disabled={loading || !email}
                        size="lg"
                    >
                        {loading ? (
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
    }, [loading, email, handleConnect]);

    return (
        <ResourcePageShell
            title="Connexion bancaire"
            subtitle="Connectez vos comptes bancaires pour synchroniser automatiquement vos finances avec votre gestion de maison"
            actions={pageActions}
            hideBackButton
            bodyClassName="space-y-8"
        >
            <div className="space-y-8">
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
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Adresse email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="votre@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        <Button
                            onClick={handleConnect}
                            disabled={loading || !email}
                            className="w-full"
                            size="lg"
                        >
                            {loading ? (
                                'Redirection en cours...'
                            ) : (
                                <>
                                    Connecter ma banque
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
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