'use client';

import React from 'react';
import LegalDocument from '@/components/LegalDocument';
import { notFound } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';

const legalDocuments = {
    'privacy': {
        titleKey: 'legal.privacyNotice',
        path: '/terms/privacy-notice.md'
    },
    'terms': {
        titleKey: 'legal.termsOfService',
        path: '/terms/terms-of-service.md'
    },
    'refund': {
        titleKey: 'legal.refundPolicy',
        path: '/terms/refund-policy.md'
    }
} as const;

type LegalDocument = keyof typeof legalDocuments;

interface LegalPageProps {
    document: LegalDocument;
    lng: string;
}

interface LegalPageParams {
    params: Promise<LegalPageProps>
}

export default function LegalPage({ params }: LegalPageParams) {
    const {document} = React.use<LegalPageProps>(params);
    const { t } = useI18n();

    if (!legalDocuments[document]) {
        notFound();
    }

    const { titleKey, path } = legalDocuments[document];

    return (
        <div className="container mx-auto px-4 py-8">
            <LegalDocument
                title={t(titleKey as any)}
                filePath={path}
            />
        </div>
    );
}
