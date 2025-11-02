'use client';
import React from "react";
import {FileText, RefreshCw, Shield} from "lucide-react";
import Link from "next/link";
import { useI18n } from '@/lib/i18n/I18nProvider';

type LegalDocumentsParams = {
    minimalist: boolean;
}

export default function LegalDocuments({ minimalist }: LegalDocumentsParams) {
    const { t } = useI18n();
    if (minimalist) {
        return (
            <>
                <div className="mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600"/>
                    <span className="text-sm text-gray-900">{t('legal.documents')}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <Link
                        href={`/legal/privacy`}
                        className="flex items-center justify-center px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <span className="text-sm text-gray-600 hover:text-blue-600">{t('legal.privacyPolicy')}</span>
                    </Link>
                    <Link
                        href={`/legal/terms`}
                        className="flex items-center justify-center px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <span className="text-sm text-gray-600 hover:text-blue-600">{t('legal.termsOfService')}</span>
                    </Link>
                    <Link
                        href={`/legal/refund`}
                        className="flex items-center justify-center px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <span className="text-sm text-gray-600 hover:text-blue-600">{t('legal.refundPolicy')}</span>
                    </Link>
                </div>
            </>
        )
    }
    return (
        <>
            <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-600"/>
                <span className="text-base font-medium text-gray-900">{t('legal.documents')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link
                    href={`/legal/privacy`}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                    <Shield className="w-4 h-4 text-gray-500 group-hover:text-blue-600"/>
                    <span
                        className="text-sm text-gray-700 group-hover:text-blue-700">{t('legal.privacyPolicy')}</span>
                </Link>
                <Link
                    href={`/legal/terms`}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                    <FileText className="w-4 h-4 text-gray-500 group-hover:text-blue-600"/>
                    <span
                        className="text-sm text-gray-700 group-hover:text-blue-700">{t('legal.termsOfService')}</span>
                </Link>
                <Link
                    href={`/legal/refund`}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                    <RefreshCw className="w-4 h-4 text-gray-500 group-hover:text-blue-600"/>
                    <span
                        className="text-sm text-gray-700 group-hover:text-blue-700">{t('legal.refundPolicy')}</span>
                </Link>
            </div>
        </>
    )
}
