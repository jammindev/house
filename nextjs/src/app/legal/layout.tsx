"use client";
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, ShieldAlert, RefreshCw } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

const legalDocuments = [
    {
        id: 'privacy',
        titleKey: 'legal.privacyPolicy',
        icon: ShieldAlert,
        descriptionKey: 'legal.privacyDesc'
    },
    {
        id: 'terms',
        titleKey: 'legal.termsOfService',
        icon: FileText,
        descriptionKey: 'legal.termsDesc'
    },
    {
        id: 'refund',
        titleKey: 'legal.refundPolicy',
        icon: RefreshCw,
        descriptionKey: 'legal.refundDesc'
    }
];

export default function LegalLayout({ children } : { children: React.ReactNode }) {
    const router = useRouter();
    const { t } = useI18n();

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="py-6">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {t('common.back')}
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar Navigation */}
                    <div className="w-full lg:w-64 flex-shrink-0">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <div className="p-4 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900">{t('legal.documents')}</h2>
                                <p className="text-sm text-gray-500 mt-1">{t('legal.sidebarDesc')}</p>
                            </div>
                            <nav className="p-4 space-y-2">
                                {legalDocuments.map((doc) => (
                                    <Link
                                        key={doc.id}
                                        href={`/legal/${doc.id}`}
                                        className="block p-3 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <doc.icon className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{t(doc.titleKey as any)}</div>
                                                <div className="text-xs text-gray-500">{t(doc.descriptionKey as any)}</div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
