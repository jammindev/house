"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, Paperclip, Calendar, User, Clock, Download } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useIncomingEmails, type IncomingEmail } from "@interactions/hooks/useIncomingEmails";
import { usePageLayoutConfig } from "@/app/app/(pages)/usePageLayoutConfig";

// Helper to format file size
const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper to get status color
const getStatusColor = (status: IncomingEmail['processing_status']) => {
    switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'processing': return 'bg-blue-100 text-blue-800';
        case 'completed': return 'bg-green-100 text-green-800';
        case 'failed': return 'bg-red-100 text-red-800';
        case 'ignored': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

export default function EmailDetailPage() {
    const { t } = useI18n();
    const { show: showToast } = useToast();
    const router = useRouter();
    const params = useParams();
    const emailId = params?.id as string;

    const { emails } = useIncomingEmails();
    const email = emails.find(e => e.id === emailId);

    // Configure page layout
    usePageLayoutConfig({
        title: email?.subject || t('emails.emailDetails'),
        subtitle: email ? t('emails.from') + ': ' + email.from_email : '',
        actions: []
    });

    if (!email) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-lg font-semibold mb-2">{t('emails.emailNotFound')}</h2>
                    <p className="text-muted-foreground mb-4">{t('emails.emailNotFoundDescription')}</p>
                    <Button onClick={() => router.push('/app/emails')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {t('emails.backToInbox')}
                    </Button>
                </div>
            </div>
        );
    }

    const handleConvertToInteraction = () => {
        const params = new URLSearchParams({
            email_id: email.id,
            subject: email.subject,
            content: email.body_text || email.body_html.replace(/<[^>]*>/g, ''),
            type: 'email'
        });

        router.push(`/app/interactions/new?${params.toString()}`);
    };

    const handleDownloadAttachment = async (attachmentId: string, filename: string) => {
        try {
            const attachment = email.attachments.find(a => a.id === attachmentId);
            if (!attachment) return;

            // Convert base64 to blob
            const byteCharacters = atob(attachment.content_base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: attachment.content_type || 'application/octet-stream' });

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showToast({
                title: t('emails.downloadStarted'),
                description: filename,
                variant: 'success'
            });
        } catch (err) {
            showToast({
                title: t('emails.downloadError'),
                description: err instanceof Error ? err.message : t('common.unexpectedError'),
                variant: 'error'
            });
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <CardTitle className="flex items-center gap-2 mb-2">
                                <Mail className="h-5 w-5" />
                                {email.subject || t('emails.noSubject')}
                            </CardTitle>
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>{email.from_email}</span>
                                    {email.from_name && <span>({email.from_name})</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    <span>{new Date(email.received_at).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Badge className={getStatusColor(email.processing_status)}>
                                {t(`emails.status.${email.processing_status}`)}
                            </Badge>
                            {email.attachments.length > 0 && (
                                <Badge variant="outline" className="block text-center">
                                    {email.attachments.length} {t('emails.attachments')}
                                </Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {/* Actions */}
                    <div className="flex gap-2 mb-4">
                        <Button onClick={() => router.push('/app/emails')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            {t('emails.backToInbox')}
                        </Button>

                        {email.processing_status === 'pending' && (
                            <Button onClick={handleConvertToInteraction}>
                                {t('emails.convertToInteraction')}
                            </Button>
                        )}

                        {email.processing_status === 'completed' && email.interaction_id && (
                            <Button
                                variant="outline"
                                onClick={() => router.push(`/app/interactions/${email.interaction_id}`)}
                            >
                                {t('emails.viewInteraction')}
                            </Button>
                        )}
                    </div>

                    {/* Error message */}
                    {email.processing_error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            <strong>{t('emails.processingError')}:</strong> {email.processing_error}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Email Content */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('emails.content')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {email.body_html ? (
                        <div
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: email.body_html }}
                        />
                    ) : email.body_text ? (
                        <div className="whitespace-pre-wrap text-sm">
                            {email.body_text}
                        </div>
                    ) : (
                        <p className="text-muted-foreground italic">{t('emails.noContent')}</p>
                    )}
                </CardContent>
            </Card>

            {/* Attachments */}
            {email.attachments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Paperclip className="h-5 w-5" />
                            {t('emails.attachments')} ({email.attachments.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {email.attachments.map((attachment) => (
                                <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Paperclip className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <div className="font-medium">{attachment.filename}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {attachment.content_type && (
                                                    <span>{attachment.content_type} • </span>
                                                )}
                                                {formatFileSize(attachment.size_bytes)}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                                    >
                                        <Download className="h-4 w-4 mr-1" />
                                        {t('common.download')}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Metadata */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('emails.metadata')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <dt className="font-medium text-muted-foreground">{t('emails.messageId')}:</dt>
                            <dd className="font-mono text-xs break-all">{email.message_id}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-muted-foreground">{t('emails.toAddress')}:</dt>
                            <dd className="font-mono text-xs">{email.to_email}</dd>
                        </div>
                        <div>
                            <dt className="font-medium text-muted-foreground">{t('emails.receivedAt')}:</dt>
                            <dd>{new Date(email.received_at).toLocaleString()}</dd>
                        </div>
                        {email.processed_at && (
                            <div>
                                <dt className="font-medium text-muted-foreground">{t('emails.processedAt')}:</dt>
                                <dd>{new Date(email.processed_at).toLocaleString()}</dd>
                            </div>
                        )}
                    </dl>
                </CardContent>
            </Card>
        </div>
    );
}