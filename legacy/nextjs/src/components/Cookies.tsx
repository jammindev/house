'use client';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Shield, X } from 'lucide-react';
import { setCookie, getCookie } from 'cookies-next/client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/I18nProvider';

const COOKIE_CONSENT_KEY = 'cookie-accept';
const COOKIE_EXPIRY_DAYS = 365;

const CookieConsent = () => {
    const [isVisible, setIsVisible] = useState(false);
    const { t } = useI18n();

    useEffect(() => {
        const consent = getCookie(COOKIE_CONSENT_KEY);
        if (!consent) {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        setCookie(COOKIE_CONSENT_KEY, 'accepted', {
            expires: new Date(Date.now() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });
        setIsVisible(false);
    };

    const handleDecline = () => {
        setCookie(COOKIE_CONSENT_KEY, 'declined', {
            expires: new Date(Date.now() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 transform transition-transform duration-500 ease-in-out w-full">
            <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 w-full">
                <div className="flex flex-col sm:flex-row sm:items-start items-center justify-between gap-4 w-full">
                    <div className="flex items-start gap-3 min-w-0">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <div className="space-y-1 min-w-0">
                            <p className="text-sm text-gray-600 break-words">
                                {t('cookies.message')}
                            </p>
                            <p className="text-sm text-gray-500 break-words">
                                {t('cookies.readOur')}{' '}
                                <Link href={`/legal/privacy`} className="text-blue-600 hover:text-blue-700 underline">
                                    {t('legal.privacyPolicy')}
                                </Link>{' '}
                                {t('auth.and')}{' '}
                                <Link href={`/legal/terms`} className="text-blue-600 hover:text-blue-700 underline">
                                    {t('legal.termsOfService')}
                                </Link>{' '}
                                {t('cookies.moreInfo')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDecline}
                            className="text-gray-600 hover:text-gray-700"
                        >
                            {t('cookies.decline')}
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleAccept}
                            className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                            {t('cookies.accept')}
                        </Button>
                        <button
                            onClick={handleDecline}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label={t('cookies.close')}
                        >
                            <X className="h-4 w-4 text-gray-500" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
