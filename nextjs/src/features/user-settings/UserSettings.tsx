// nextjs/src/features/user-settings/UserSettings.tsx
"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import { Key, User, CheckCircle } from 'lucide-react';
import { MFASetup } from '@/components/MFASetup';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { compressFileForUpload } from '@documents/utils/fileCompression';
import { usePageLayoutConfig } from '@/app/app/(pages)/usePageLayoutConfig';
import { HouseholdManagement } from './components/HouseholdManagement';

export function UserSettings() {
    const { user, refreshUser } = useGlobal();
    const { t, locale, setLocale } = useI18n();
    const setLayout = usePageLayoutConfig();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [displayNameLoading, setDisplayNameLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [themeLoading, setThemeLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [displayName, setDisplayName] = useState(user?.displayName ?? '');
    const [selectedTheme, setSelectedTheme] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setDisplayName(user?.displayName ?? '');
    }, [user?.displayName]);

    useEffect(() => {
        const fetchUserTheme = async () => {
            try {
                const supabase = await createSPASassClient();
                const client = supabase.getSupabaseClient();
                const { data: { user: authUser } } = await client.auth.getUser();
                const theme = authUser?.user_metadata?.theme ?? (process.env.NEXT_PUBLIC_THEME?.replace('theme-', '') ?? 'sass3');
                setSelectedTheme(theme);
            } catch (err) {
                console.warn('Failed to fetch user theme:', err);
                setSelectedTheme(process.env.NEXT_PUBLIC_THEME?.replace('theme-', '') ?? 'sass3');
            }
        };
        fetchUserTheme();
    }, []);

    useEffect(() => {
        setLayout({ title: t('settings.title'), subtitle: t('settings.subtitle'), hideBackButton: true });
    }, [setLayout, t]);

    const handleDisplayNameSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setDisplayNameLoading(true);
        setError('');
        setSuccess('');

        const trimmed = displayName.trim();

        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();
            const { error } = await client.auth.updateUser({
                data: { display_name: trimmed.length > 0 ? trimmed : null }
            });
            if (error) throw error;
            await refreshUser();
            setDisplayName(trimmed);
            setSuccess(t('settings.displayNameUpdated'));
        } catch (err: Error | unknown) {
            if (err instanceof Error) {
                console.error('Error updating display name:', err);
                setError(err.message);
            } else {
                console.error('Error updating display name:', err);
                setError(t('settings.displayNameUpdateFailed'));
            }
        } finally {
            setDisplayNameLoading(false);
        }
    };

    const handleAvatarUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
        if (!user?.id) return;
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setAvatarLoading(true);
        setError('');
        setSuccess('');

        if (!file.type.startsWith('image/')) {
            setError(t('settings.avatarUnsupportedType'));
            setAvatarLoading(false);
            return;
        }

        try {
            const { file: processed } = await compressFileForUpload(file, {
                image: {
                    minBytes: 25 * 1024,
                    maxSizeMB: 0.75,
                    maxWidthOrHeight: 512,
                    initialQuality: 0.8,
                },
            });

            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();
            const rawExtension = processed.name.includes('.') ? processed.name.split('.').pop() : null;
            const extension = (() => {
                const normalized = rawExtension ? rawExtension.toLowerCase() : null;
                const allowed = ['png', 'jpg', 'jpeg', 'webp'];
                if (normalized && allowed.includes(normalized)) return normalized;
                return processed.type === 'image/png'
                    ? 'png'
                    : processed.type === 'image/jpeg'
                        ? 'jpg'
                        : 'webp';
            })();
            const objectPath = `${user.id}/avatar.${extension}`;

            const { error: uploadError } = await client.storage
                .from('avatars')
                .upload(objectPath, processed, { upsert: true });
            if (uploadError) throw uploadError;

            const { error: updateError } = await client.auth.updateUser({
                data: { avatar_path: objectPath },
            });
            if (updateError) throw updateError;

            await refreshUser();
            setSuccess(t('settings.avatarUpdated'));
        } catch (err: Error | unknown) {
            if (err instanceof Error) {
                console.error('Error uploading avatar:', err);
                setError(err.message);
            } else {
                console.error('Error uploading avatar:', err);
                setError(t('settings.avatarUpdateFailed'));
            }
        } finally {
            setAvatarLoading(false);
        }
    };

    const handleAvatarDelete = async () => {
        if (!user?.id || !user.avatarPath) {
            return;
        }
        setAvatarLoading(true);
        setError('');
        setSuccess('');

        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();
            await client.storage.from('avatars').remove([user.avatarPath]);
            const { error: updateError } = await client.auth.updateUser({
                data: { avatar_path: null },
            });
            if (updateError) throw updateError;
            await refreshUser();
            setSuccess(t('settings.avatarRemoved'));
        } catch (err: Error | unknown) {
            if (err instanceof Error) {
                console.error('Error removing avatar:', err);
                setError(err.message);
            } else {
                console.error('Error removing avatar:', err);
                setError(t('settings.avatarRemoveFailed'));
            }
        } finally {
            setAvatarLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleThemeChange = async (newTheme: string) => {
        setThemeLoading(true);
        setError('');
        setSuccess('');

        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();
            const { error } = await client.auth.updateUser({
                data: { theme: newTheme }
            });
            if (error) throw error;
            
            setSelectedTheme(newTheme);
            setSuccess(t('settings.themeUpdated'));
            
            // Reload the page to apply the new theme
            window.location.reload();
        } catch (err: Error | unknown) {
            if (err instanceof Error) {
                console.error('Error updating theme:', err);
                setError(err.message);
            } else {
                console.error('Error updating theme:', err);
                setError('Failed to update theme');
            }
        } finally {
            setThemeLoading(false);
        }
    };


    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError(t('settings.passwordMismatch'));
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();

            const { error } = await client.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            setSuccess(t('settings.passwordUpdated'));
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: Error | unknown) {
            if (err instanceof Error) {
                console.error('Error updating password:', err);
                setError(err.message);
            } else {
                console.error('Error updating password:', err);
                setError(t('settings.passwordUpdateFailed'));
            }
        } finally {
            setLoading(false);
        }
    };



    return (
        <div>
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {success && (
                <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <HouseholdManagement />
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                {t('settings.language')}
                            </CardTitle>
                            <CardDescription>{t('settings.languageDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <select
                                    value={locale}
                                    onChange={async (e) => {
                                        const newLocale = e.target.value as 'en' | 'fr';
                                        setLocale(newLocale);
                                        try {
                                            const supabase = await createSPASassClient();
                                            const client = supabase.getSupabaseClient();
                                            await client.auth.updateUser({ data: { locale: newLocale } });
                                            setSuccess(t('settings.languageUpdated'));
                                        } catch (err) {
                                            console.warn('Locale save failed', err);
                                        }
                                    }}
                                    className="h-10 px-3 border rounded-md text-sm"
                                >
                                    <option value="en">{t('language.english')}</option>
                                    <option value="fr">{t('language.french')}</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className='text-base '>{t('settings.displayName')}</CardTitle>
                            <CardDescription>{t('settings.displayNameDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleDisplayNameSave} className="space-y-4">
                                <div>
                                    <label htmlFor="display-name" className="block text-sm font-medium text-gray-700">
                                        {t('settings.displayNameLabel')}
                                    </label>
                                    <input
                                        type="text"
                                        id="display-name"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder={t('settings.displayNamePlaceholder')}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-sm"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">{t('settings.displayNameHelper')}</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={displayNameLoading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                >
                                    {displayNameLoading ? t('common.saving') : t('common.save')}
                                </button>
                            </form>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className='text-base '>{t('settings.avatar')}</CardTitle>
                            <CardDescription>{t('settings.avatarDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                                    {user?.avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={user.avatarUrl} alt={t('settings.avatarAlt')} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-2xl font-semibold text-primary-700">
                                            {user?.displayName?.[0]?.toUpperCase() ??
                                                user?.email?.[0]?.toUpperCase() ??
                                                "?"}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/webp"
                                            onChange={handleAvatarUpload}
                                            disabled={avatarLoading}
                                            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100 disabled:opacity-50"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">{t('settings.avatarHelper')}</p>
                                    </div>
                                    {user?.avatarPath ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleAvatarDelete}
                                            disabled={avatarLoading}
                                        >
                                            {avatarLoading ? t('common.processing') : t('settings.avatarRemove')}
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className='text-base'>{t('settings.theme')}</CardTitle>
                            <CardDescription>{t('settings.themeDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3">
                                <select
                                    value={selectedTheme}
                                    onChange={(e) => handleThemeChange(e.target.value)}
                                    disabled={themeLoading}
                                    className="h-10 px-3 border rounded-md text-sm disabled:opacity-50"
                                    aria-label={t('settings.theme')}
                                >
                                    <option value="blue">{t('theme.blue')}</option>
                                    <option value="sass">{t('theme.sass')}</option>
                                    <option value="sass2">{t('theme.sass2')}</option>
                                    <option value="sass3">{t('theme.sass3')}</option>
                                    <option value="house">{t('theme.house')}</option>
                                    <option value="purple">{t('theme.purple')}</option>
                                    <option value="green">{t('theme.green')}</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="h-5 w-5" />
                                {t('settings.userDetails')}
                            </CardTitle>
                            <CardDescription>{t('settings.accountInfo')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-500">{t('settings.userId')}</label>
                                <p className="mt-1 text-sm">{user?.id}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-500">{t('settings.email')}</label>
                                <p className="mt-1 text-sm">{user?.email}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Key className="h-5 w-5" />
                                {t('settings.changePassword')}
                            </CardTitle>
                            <CardDescription>{t('settings.updatePassword')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                <div>
                                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">{t('settings.newPassword')}</label>
                                    <input
                                        type="password"
                                        id="new-password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-sm"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">{t('settings.confirmPassword')}</label>
                                    <input
                                        type="password"
                                        id="confirm-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-sm"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                                >
                                    {loading ? t('settings.updating') : t('settings.updatePasswordCta')}
                                </button>
                            </form>
                        </CardContent>
                    </Card>

                    <MFASetup
                        onStatusChange={() => {
                            setSuccess(t('mfa.settingsUpdated'));
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default UserSettings;
