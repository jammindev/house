"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Mail, Paperclip, Check, X, Clock, AlertCircle, Trash2, ExternalLink, RotateCcw, Copy, Download, Save } from "lucide-react";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useIncomingEmails, type IncomingEmail } from "@interactions/hooks/useIncomingEmails";
import { useEmailAttachments } from "@interactions/hooks/useEmailAttachments";
import { saveEmailAttachmentAsDocument } from "@interactions/utils/saveEmailAttachment";
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

// Component for email item
function EmailItem({
    email,
    onConvert,
    onIgnore,
    onViewDetails
}: {
    email: IncomingEmail;
    onConvert: (emailId: string) => void;
    onIgnore: (emailId: string) => void;
    onViewDetails: (emailId: string) => void;
}) {
    const { t } = useI18n();
    const { selectedHouseholdId } = useGlobal();
    const { show: showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [savingAttachments, setSavingAttachments] = useState<Set<string>>(new Set());
    
    // Fetch actual attachments from database
    const { attachments, markAsSaved } = useEmailAttachments(email.id);

    const handleConvert = async () => {
        if (email.processing_status !== 'pending') return;
        setLoading(true);
        try {
            await onConvert(email.id);
        } finally {
            setLoading(false);
        }
    };

    const handleIgnore = async () => {
        if (email.processing_status !== 'pending') return;
        setLoading(true);
        try {
            await onIgnore(email.id);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAttachment = async (attachmentId: string) => {
        if (!selectedHouseholdId) {
            showToast({
                title: t('emails.saveError'),
                description: t('emails.noHouseholdSelected'),
                variant: 'error'
            });
            return;
        }

        setSavingAttachments(prev => new Set(prev).add(attachmentId));
        
        try {
            const attachment = attachments.find(a => a.id === attachmentId);
            if (!attachment) throw new Error('Attachment not found');

            const documentId = await saveEmailAttachmentAsDocument(
                attachment,
                selectedHouseholdId
            );

            await markAsSaved(attachmentId, documentId);

            showToast({
                title: t('emails.attachmentSaved'),
                description: t('emails.attachmentSavedDescription', { name: attachment.filename }),
                variant: 'success'
            });
        } catch (err) {
            showToast({
                title: t('emails.saveError'),
                description: err instanceof Error ? err.message : t('common.unexpectedError'),
                variant: 'error'
            });
        } finally {
            setSavingAttachments(prev => {
                const newSet = new Set(prev);
                newSet.delete(attachmentId);
                return newSet;
            });
        }
    };

    const hasAttachments = attachments.length > 0;
    const isPending = email.processing_status === 'pending';

    return (
        <Card className="relative">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <h3 className="font-medium truncate">{email.subject || t('emails.noSubject')}</h3>
                            {hasAttachments && (
                                <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t('emails.from')}: {email.from_email}
                            {email.from_name && ` (${email.from_name})`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {t('emails.received')}: {new Date(email.received_at).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <Badge className={getStatusColor(email.processing_status)}>
                            {email.processing_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {email.processing_status === 'completed' && <Check className="h-3 w-3 mr-1" />}
                            {email.processing_status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {email.processing_status === 'ignored' && <X className="h-3 w-3 mr-1" />}
                            {email.processing_status === 'processing' && <Clock className="h-3 w-3 mr-1 animate-spin" />}
                            {t(`emails.status.${email.processing_status}`)}
                        </Badge>
                        {hasAttachments && (
                            <Badge variant="outline" className="text-xs">
                                {email.attachments.length} {t('emails.attachments')}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {/* Email preview */}
                <div className="mb-3">
                    <div className="text-sm text-muted-foreground bg-gray-50 rounded p-2 max-h-24 overflow-hidden">
                        {email.body_text || email.body_html ? (
                            <div className="line-clamp-3">
                                {email.body_text || email.body_html.replace(/<[^>]*>/g, '')}
                            </div>
                        ) : (
                            <em>{t('emails.noContent')}</em>
                        )}
                    </div>
                </div>

                {/* Attachments preview */}
                {hasAttachments && (
                    <div className="mb-3">
                        <h4 className="text-sm font-medium mb-2">{t('emails.attachments')}:</h4>
                        <div className="space-y-2">
                            {attachments.slice(0, 3).map((attachment) => {
                                const isSaving = savingAttachments.has(attachment.id);
                                const isSaved = attachment.document_id !== null;
                                
                                return (
                                    <div key={attachment.id} className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded-md bg-white">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                            <span className="text-sm truncate">{attachment.filename}</span>
                                            <span className="text-xs text-muted-foreground flex-shrink-0">
                                                ({formatFileSize(attachment.size_bytes ? Number(attachment.size_bytes) : null)})
                                            </span>
                                            {isSaved && (
                                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                                    <Check className="h-3 w-3 mr-1" />
                                                    {t('emails.saved')}
                                                </Badge>
                                            )}
                                        </div>
                                        {!isSaved && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={isSaving}
                                                onClick={() => handleSaveAttachment(attachment.id)}
                                                className="flex-shrink-0"
                                            >
                                                {isSaving ? (
                                                    <Clock className="h-3 w-3 mr-1 animate-spin" />
                                                ) : (
                                                    <Save className="h-3 w-3 mr-1" />
                                                )}
                                                {isSaving ? t('emails.saving') : t('emails.save')}
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                            {attachments.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                    {t('emails.andXMore', { count: attachments.length - 3 })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Error message */}
                {email.processing_error && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        {email.processing_error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(email.id)}
                    >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {t('emails.viewDetails')}
                    </Button>

                    {isPending && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleIgnore}
                                disabled={loading}
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                {t('emails.ignore')}
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleConvert}
                                disabled={loading}
                            >
                                <Check className="h-3 w-3 mr-1" />
                                {t('emails.convertToInteraction')}
                            </Button>
                        </>
                    )}

                    {email.processing_status === 'completed' && email.interaction_id && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/app/interactions/${email.interaction_id}`, '_blank')}
                        >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            {t('emails.viewInteraction')}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function EmailInboxPage() {
    const { t } = useI18n();
    const { selectedHouseholdId: householdId, households } = useGlobal();
    const { show: showToast } = useToast();
    const router = useRouter();

    const {
        emails,
        loading,
        error,
        refreshEmails,
        markAsIgnored,
        getUnreadCount
    } = useIncomingEmails();

    // Get current household info
    const currentHousehold = householdId ? households.find(h => h.id === householdId) : null;
    const emailAddress = currentHousehold?.inbound_email_alias
        ? `${currentHousehold.inbound_email_alias}@mail.house.jammin-dev.com`
        : null;

    const pageActions = useMemo(() => [
        {
            label: t('common.refresh'),
            icon: RotateCcw,
            onClick: refreshEmails,
            disabled: loading
        }
    ], [t, refreshEmails, loading]);

    const pageLayoutConfig = useMemo(() => ({
        title: t('emails.inbox'),
        subtitle: emailAddress ? `${t('emails.inboxSubtitle')} • ${emailAddress}` : t('emails.inboxSubtitle'),
        actions: pageActions
    }), [t, emailAddress, pageActions]);

    // Configure page layout
    usePageLayoutConfig(pageLayoutConfig);

    const filteredEmails = useMemo(() => {
        const pending = emails.filter(email => email.processing_status === 'pending');
        const processed = emails.filter(email => email.processing_status !== 'pending');
        return { pending, processed };
    }, [emails]);

    const handleConvertEmail = async (emailId: string) => {
        const email = emails.find(e => e.id === emailId);
        if (!email) return;

        try {
            // Navigate to interaction creation with email prefill
            const params = new URLSearchParams({
                email_id: emailId,
                subject: email.subject,
                content: email.body_text || email.body_html.replace(/<[^>]*>/g, ''),
                type: 'email'
            });

            router.push(`/app/interactions/new?${params.toString()}`);
        } catch (err) {
            showToast({
                title: t('emails.convertError'),
                description: err instanceof Error ? err.message : t('common.unexpectedError'),
                variant: 'error'
            });
        }
    };

    const handleIgnoreEmail = async (emailId: string) => {
        try {
            await markAsIgnored(emailId);
            showToast({
                title: t('emails.emailIgnored'),
                variant: 'success'
            });
        } catch (err) {
            showToast({
                title: t('emails.ignoreError'),
                description: err instanceof Error ? err.message : t('common.unexpectedError'),
                variant: 'error'
            });
        }
    };

    const handleViewDetails = (emailId: string) => {
        // Could open a modal or navigate to a detail page
        router.push(`/app/emails/${emailId}`);
    };

    if (!householdId) {
        return (
            <Card>
                <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">{t('emails.selectHousehold')}</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600 mb-4">{error}</p>
                    <Button onClick={refreshEmails}>{t('common.retry')}</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Email Address Card */}
            {emailAddress && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            {t('emails.yourAddress')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                            <code className="flex-1 text-sm font-mono">{emailAddress}</code>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(emailAddress);
                                    showToast({
                                        title: t('common.copied'),
                                        description: t('emails.addressCopied'),
                                        variant: 'success'
                                    });
                                }}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{getUnreadCount()}</div>
                        <p className="text-xs text-muted-foreground">{t('emails.pendingEmails')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                            {emails.filter(e => e.processing_status === 'completed').length}
                        </div>
                        <p className="text-xs text-muted-foreground">{t('emails.processedEmails')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{emails.length}</div>
                        <p className="text-xs text-muted-foreground">{t('emails.totalEmails')}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Pending emails */}
            {filteredEmails.pending.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-yellow-600" />
                        {t('emails.pendingEmails')} ({filteredEmails.pending.length})
                    </h2>
                    <div className="space-y-4">
                        {filteredEmails.pending.map((email) => (
                            <EmailItem
                                key={email.id}
                                email={email}
                                onConvert={handleConvertEmail}
                                onIgnore={handleIgnoreEmail}
                                onViewDetails={handleViewDetails}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Processed emails */}
            {filteredEmails.processed.length > 0 && (
                <div>
                    <Separator className="my-6" />
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-600" />
                        {t('emails.processedEmails')} ({filteredEmails.processed.length})
                    </h2>
                    <div className="space-y-4">
                        {filteredEmails.processed.map((email) => (
                            <EmailItem
                                key={email.id}
                                email={email}
                                onConvert={handleConvertEmail}
                                onIgnore={handleIgnoreEmail}
                                onViewDetails={handleViewDetails}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {emails.length === 0 && !loading && (
                <Card>
                    <CardContent className="text-center py-12">
                        <Mail className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">{t('emails.noEmails')}</h3>
                        <p className="text-muted-foreground mb-4">
                            {t('emails.noEmailsDescription')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {t('emails.yourAddress')}: <strong>[alias]@house.jammin-dev.com</strong>
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Loading state */}
            {loading && emails.length === 0 && (
                <Card>
                    <CardContent className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                        <p className="text-muted-foreground">{t('emails.loadingEmails')}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
