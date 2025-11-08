// nextjs/src/features/user-settings/components/HouseholdManagement.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Home, Users, Crown, Trash2, LogOut, Plus, AlertTriangle } from 'lucide-react';

interface HouseholdMember {
    user_id: string;
    user_email: string;
    user_display_name: string;
    role: string;
    joined_at: string;
}

interface ExtendedHousehold {
    id: string;
    name: string;
    role: string;
    memberCount?: number;
    members?: HouseholdMember[];
}

export function HouseholdManagement() {
    const { t } = useI18n();
    const { user, households, selectedHouseholdId, setSelectedHouseholdId, refreshHouseholds } = useGlobal();
    const [extendedHouseholds, setExtendedHouseholds] = useState<ExtendedHousehold[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newHouseholdName, setNewHouseholdName] = useState('');
    const [creatingHousehold, setCreatingHousehold] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = useState<string | null>(null);

    const loadHouseholdDetails = async () => {
        if (!user) return;
        setLoading(true);
        setError('');

        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();

            // Get user's role in each household
            const { data: memberships, error: memberError } = await client
                .from('household_members')
                .select('household_id, role')
                .eq('user_id', user.id);

            if (memberError) throw memberError;

            const extended: ExtendedHousehold[] = households.map(h => {
                const membership = memberships?.find(m => m.household_id === h.id);
                return {
                    ...h,
                    role: membership?.role || 'member'
                };
            });

            setExtendedHouseholds(extended);
        } catch (err: Error | unknown) {
            console.error('Error loading household details:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to load household details');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHouseholdDetails();
    }, [user, households]);

    const handleCreateHousehold = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newHouseholdName.trim()) {
            setError(t('settings.householdNameRequired'));
            return;
        }

        setCreatingHousehold(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/households', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newHouseholdName.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create household');
            }

            setSuccess(t('settings.householdCreated'));
            setNewHouseholdName('');
            setShowCreateForm(false);
            await refreshHouseholds();
        } catch (err: Error | unknown) {
            console.error('Create household error:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(t('settings.householdCreateFailed'));
            }
        } finally {
            setCreatingHousehold(false);
        }
    };

    const handleDeleteHousehold = async (householdId: string) => {
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`/api/households/${householdId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete household');
            }

            setSuccess(t('settings.householdDeleted'));
            setConfirmDelete(null);
            await refreshHouseholds();
        } catch (err: Error | unknown) {
            console.error('Delete household error:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(t('settings.householdDeleteFailed'));
            }
        }
    };

    const handleLeaveHousehold = async (householdId: string) => {
        setError('');
        setSuccess('');

        try {
            const response = await fetch(`/api/households/${householdId}/leave`, {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to leave household');
            }

            setSuccess(t('settings.householdLeft'));
            setConfirmLeave(null);
            await refreshHouseholds();
        } catch (err: Error | unknown) {
            console.error('Leave household error:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(t('settings.householdLeaveFailed'));
            }
        }
    };

    const handleSwitchHousehold = async (householdId: string) => {
        setSelectedHouseholdId(householdId);
        setSuccess(t('settings.householdSwitched'));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    {t('settings.households')}
                </CardTitle>
                <CardDescription>{t('settings.householdsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert>
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">{t('settings.currentHouseholds')}</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCreateForm(true)}
                            className="flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            {t('settings.createHousehold')}
                        </Button>
                    </div>

                    {loading ? (
                        <div className="text-center py-4">
                            <div className="inline-flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                                {t('common.loading')}
                            </div>
                        </div>
                    ) : extendedHouseholds.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Home className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                            <p>{t('settings.noHouseholds')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {extendedHouseholds.map(household => (
                                <div
                                    key={household.id}
                                    className={`border rounded-lg p-4 ${household.id === selectedHouseholdId ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-medium">{household.name}</h4>
                                                {household.role === 'owner' && (
                                                    <Crown className="h-4 w-4 text-yellow-500" />
                                                )}
                                                {household.id === selectedHouseholdId && (
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                                        Actuel
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                                <span className="flex items-center gap-1">
                                                    <Users className="h-4 w-4" />
                                                    {t(`settings.role.${household.role}`)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {household.id !== selectedHouseholdId && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleSwitchHousehold(household.id)}
                                                >
                                                    {t('settings.switchToHousehold')}
                                                </Button>
                                            )}

                                            {household.role === 'owner' ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setConfirmDelete(household.id)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setConfirmLeave(household.id)}
                                                    className="text-orange-600 hover:text-orange-700"
                                                >
                                                    <LogOut className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Create household form */}
                {showCreateForm && (
                    <div className="border-t pt-6">
                        <form onSubmit={handleCreateHousehold} className="space-y-4">
                            <div>
                                <label htmlFor="household-name" className="block text-sm font-medium text-gray-700">
                                    {t('settings.householdName')}
                                </label>
                                <input
                                    type="text"
                                    id="household-name"
                                    value={newHouseholdName}
                                    onChange={(e) => setNewHouseholdName(e.target.value)}
                                    placeholder={t('settings.householdNamePlaceholder')}
                                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 text-sm"
                                    required
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    type="submit"
                                    disabled={creatingHousehold}
                                    className="flex-1"
                                >
                                    {creatingHousehold ? t('settings.creatingHousehold') : t('settings.createHousehold')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowCreateForm(false);
                                        setNewHouseholdName('');
                                    }}
                                >
                                    {t('common.cancel')}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Delete confirmation */}
                {confirmDelete && (
                    <div className="border-t pt-6">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                                <h4 className="font-medium text-red-800">
                                    {t('settings.confirmDeleteHousehold')}
                                </h4>
                            </div>
                            <p className="text-sm text-red-700 mb-4">
                                {t('settings.confirmDeleteHouseholdDesc', {
                                    name: extendedHouseholds.find(h => h.id === confirmDelete)?.name || ''
                                })}
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteHousehold(confirmDelete)}
                                >
                                    {t('settings.deleteHousehold')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmDelete(null)}
                                >
                                    {t('common.cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Leave confirmation */}
                {confirmLeave && (
                    <div className="border-t pt-6">
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <LogOut className="h-5 w-5 text-orange-600" />
                                <h4 className="font-medium text-orange-800">
                                    {t('settings.confirmLeaveHousehold')}
                                </h4>
                            </div>
                            <p className="text-sm text-orange-700 mb-4">
                                {t('settings.confirmLeaveHouseholdDesc', {
                                    name: extendedHouseholds.find(h => h.id === confirmLeave)?.name || ''
                                })}
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleLeaveHousehold(confirmLeave)}
                                    className="text-orange-600 hover:text-orange-700"
                                >
                                    {t('settings.leaveHousehold')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirmLeave(null)}
                                >
                                    {t('common.cancel')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}