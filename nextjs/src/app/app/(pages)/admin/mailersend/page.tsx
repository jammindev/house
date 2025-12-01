"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ToastProvider';
import { Settings, Mail, Webhook, CheckCircle, XCircle, Copy } from 'lucide-react';

interface MailerSendConfig {
    domains: Array<{
        id: string;
        name: string;
        send_paused: boolean;
    }>;
    webhooks: Array<{
        id: string;
        name: string;
        url: string;
        events: string[];
        enabled: boolean;
    }>;
}

export default function MailerSendSetupPage() {
    const { show } = useToast();
    const [config, setConfig] = useState<MailerSendConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [webhookUrl, setWebhookUrl] = useState('');

    // Generate webhook URL based on current location
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const baseUrl = `${window.location.protocol}//${window.location.host}`;
            setWebhookUrl(`${baseUrl}/api/inbound-email`);
        }
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/mailersend/setup');
            const result = await response.json();

            if (result.success) {
                setConfig(result.data);
                show({ title: 'Configuration loaded successfully', variant: 'success' });
            } else {
                throw new Error(result.error || 'Failed to load configuration');
            }
        } catch (error) {
            console.error('Error fetching config:', error);
            show({ title: error instanceof Error ? error.message : 'Failed to load configuration', variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const createWebhook = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/mailersend/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_webhook',
                    webhookUrl: webhookUrl,
                }),
            });

            const result = await response.json();

            if (result.success) {
                show({ title: 'Webhook created successfully!', variant: 'success' });
                await fetchConfig(); // Refresh config
            } else {
                throw new Error(result.error || 'Failed to create webhook');
            }
        } catch (error) {
            console.error('Error creating webhook:', error);
            show({ title: error instanceof Error ? error.message : 'Failed to create webhook', variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        show({ title: 'Copied to clipboard', variant: 'success' });
    };

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Settings className="h-8 w-8" />
                <div>
                    <h1 className="text-2xl font-bold">MailerSend Configuration</h1>
                    <p className="text-muted-foreground">
                        Configure email ingestion for your House application
                    </p>
                </div>
            </div>

            <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                    <strong>API Token:</strong> Your MailerSend token is configured and ready to use.
                    Make sure to configure the inbound domain and webhook in your MailerSend dashboard.
                </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Current Configuration */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Current Configuration
                        </CardTitle>
                        <CardDescription>
                            View your MailerSend domains and webhooks
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Button onClick={fetchConfig} disabled={loading} className="w-full">
                                {loading ? 'Loading...' : 'Load Configuration'}
                            </Button>

                            {config && (
                                <div className="space-y-4">
                                    {/* Domains */}
                                    <div>
                                        <h4 className="font-medium mb-2 flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            Domains ({config.domains.length})
                                        </h4>
                                        {config.domains.length > 0 ? (
                                            <div className="space-y-2">
                                                {config.domains.map((domain) => (
                                                    <div key={domain.id} className="flex items-center justify-between p-2 border rounded">
                                                        <span className="font-mono text-sm">{domain.name}</span>
                                                        <Badge variant={domain.send_paused ? 'destructive' : 'default'}>
                                                            {domain.send_paused ? 'Paused' : 'Active'}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No domains configured</p>
                                        )}
                                    </div>

                                    {/* Webhooks */}
                                    <div>
                                        <h4 className="font-medium mb-2 flex items-center gap-2">
                                            <Webhook className="h-4 w-4" />
                                            Webhooks ({config.webhooks.length})
                                        </h4>
                                        {config.webhooks.length > 0 ? (
                                            <div className="space-y-2">
                                                {config.webhooks.map((webhook) => (
                                                    <div key={webhook.id} className="p-3 border rounded space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium">{webhook.name}</span>
                                                            <div className="flex items-center gap-2">
                                                                {webhook.enabled ? (
                                                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                                                ) : (
                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                )}
                                                                <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
                                                                    {webhook.enabled ? 'Enabled' : 'Disabled'}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground font-mono">
                                                            {webhook.url}
                                                        </div>
                                                        <div className="text-xs">
                                                            Events: {webhook.events.join(', ')}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No webhooks configured</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Webhook Setup */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Webhook className="h-5 w-5" />
                            Webhook Setup
                        </CardTitle>
                        <CardDescription>
                            Create a webhook for email ingestion
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="webhook-url" className="block text-sm font-medium mb-2">
                                    Webhook URL
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        id="webhook-url"
                                        value={webhookUrl}
                                        onChange={(e) => setWebhookUrl(e.target.value)}
                                        placeholder="https://your-domain.com/api/inbound-email"
                                        className="font-mono"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyToClipboard(webhookUrl)}
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    This URL will receive inbound email webhooks from MailerSend
                                </p>
                            </div>

                            <Button
                                onClick={createWebhook}
                                disabled={loading || !webhookUrl}
                                className="w-full"
                            >
                                {loading ? 'Creating...' : 'Create Webhook'}
                            </Button>

                            <Alert>
                                <AlertDescription>
                                    <strong>Next steps:</strong>
                                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                                        <li>Configure an inbound domain in your MailerSend dashboard</li>
                                        <li>Add the required MX records to your DNS</li>
                                        <li>Set up a webhook secret for security</li>
                                        <li>Test email ingestion</li>
                                    </ol>
                                </AlertDescription>
                            </Alert>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}