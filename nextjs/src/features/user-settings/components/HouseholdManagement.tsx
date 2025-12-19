// nextjs/src/features/user-settings/components/HouseholdManagement.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SheetDialog } from '@/components/ui/sheet-dialog';
import { useGlobal } from '@/lib/context/GlobalContext';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Home, Users, Crown, Trash2, LogOut, Plus, AlertTriangle, Save, X } from 'lucide-react';

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
    address?: string;
    city?: string;
    country?: string;
    context_notes?: string;
    ai_prompt_context?: string;
}

export function HouseholdManagement() {
    const { t } = useI18n();
    const { user, households, selectedHouseholdId, setSelectedHouseholdId, refreshHouseholds } = useGlobal();
    const [extendedHouseholds, setExtendedHouseholds] = useState<ExtendedHousehold[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newHouseholdName, setNewHouseholdName] = useState('');
    const [creatingHousehold, setCreatingHousehold] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmLeave, setConfirmLeave] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        address: '',
        city: '',
        country: '',
        context_notes: '',
        ai_prompt_context: ''
    });
    const [savingEdit, setSavingEdit] = useState(false);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [selectedHousehold, setSelectedHousehold] = useState<ExtendedHousehold | null>(null);

    const loadHouseholdDetails = async () => {
        if (!user) return;
        setLoading(true);
        setError('');

        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();

            // Get user's role in each household with additional household info
            // TODO: Temporarily commented until migration is applied
            // const { data: householdsWithContext, error: householdError } = await client
            //     .from('households')
            //     .select('id, name, address, city, country, context_notes, ai_prompt_context')
            //     .in('id', households.map(h => h.id));

            // if (householdError) throw householdError;

            const { data: memberships, error: memberError } = await client
                .from('household_members')
                .select('household_id, role')
                .eq('user_id', user.id);

            if (memberError) throw memberError;

            const extended: ExtendedHousehold[] = households.map(h => {
                const membership = memberships?.find(m => m.household_id === h.id);
                // TODO: Uncomment when migration is applied
                // const contextInfo = householdsWithContext?.find(hc => hc.id === h.id);
                return {
                    ...h,
                    role: membership?.role || 'member',
                    // TODO: Uncomment when migration is applied
                    address: '', // contextInfo?.address || '',
                    city: '', // contextInfo?.city || '',
                    country: '', // contextInfo?.country || '',
                    context_notes: '', // contextInfo?.context_notes || '',
                    ai_prompt_context: '' // contextInfo?.ai_prompt_context || ''
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
                body: JSON.stringify({
                    name: newHouseholdName.trim()
                    // TODO: Add context fields when migration is applied
                    // address: editForm.address,
                    // city: editForm.city,
                    // country: editForm.country,
                    // context_notes: editForm.context_notes,
                    // ai_prompt_context: editForm.ai_prompt_context
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create household');
            }

            setSuccess(t('settings.householdCreated'));
            setNewHouseholdName('');
            setEditForm({
                name: '',
                address: '',
                city: '',
                country: '',
                context_notes: '',
                ai_prompt_context: ''
            });
            setCreateDialogOpen(false);
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

    const handleDeleteFromSheet = () => {
        if (selectedHousehold) {
            setConfirmDelete(selectedHousehold.id);
            setSheetOpen(false);
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

    const handleStartEdit = (household: ExtendedHousehold) => {
        setSelectedHousehold(household);
        setEditForm({
            name: household.name,
            address: household.address || '',
            city: household.city || '',
            country: household.country || '',
            context_notes: household.context_notes || '',
            ai_prompt_context: household.ai_prompt_context || ''
        });
        setError('');
        setSuccess('');
        setSheetOpen(true);
    };

    const handleCancelEdit = () => {
        setSelectedHousehold(null);
        setEditForm({
            name: '',
            address: '',
            city: '',
            country: '',
            context_notes: '',
            ai_prompt_context: ''
        });
        setSheetOpen(false);
    };

    const handleSaveEdit = async () => {
        if (!selectedHousehold || !editForm.name.trim()) {
            setError(t('settings.householdNameRequired'));
            return;
        }

        setSavingEdit(true);
        setError('');
        setSuccess('');

        try {
            const supabase = await createSPASassClient();
            const client = supabase.getSupabaseClient();

            const { error } = await client
                .from('households')
                .update({
                    name: editForm.name.trim(),
                    address: editForm.address,
                    city: editForm.city,
                    country: editForm.country,
                    context_notes: editForm.context_notes,
                    ai_prompt_context: editForm.ai_prompt_context
                })
                .eq('id', selectedHousehold.id);

            if (error) throw error;

            setSuccess(t('settings.householdUpdated'));
            setSelectedHousehold(null);
            setSheetOpen(false);
            await refreshHouseholds();
            await loadHouseholdDetails();
        } catch (err: Error | unknown) {
            console.error('Update household error:', err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(t('settings.householdUpdateFailed'));
            }
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
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
                            size="icon"
                            onClick={() => setCreateDialogOpen(true)}
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
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {extendedHouseholds.map(household => (
                                <Card
                                    key={household.id}
                                    className={`cursor-pointer border border-slate-200 shadow-sm hover:shadow-md transition-shadow ${household.id === selectedHouseholdId ? 'border-blue-500 bg-blue-50' : ''
                                        }`}
                                    onClick={() => handleStartEdit(household)}
                                >
                                    <CardHeader className="space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex flex-col gap-1 flex-1">
                                                <div className="flex items-center gap-2">
                                                    {household.role === 'owner' && (
                                                        <Crown className="h-4 w-4 text-yellow-500" />
                                                    )}
                                                    <h3 className="text-base font-semibold text-slate-900 line-clamp-2">
                                                        {household.name}
                                                    </h3>
                                                    {household.id === selectedHouseholdId && (
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                                            Actuel
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                                        <Users className="h-3.5 w-3.5" />
                                                        {t(`settings.role.${household.role}`)}
                                                    </span>
                                                    {household.city && (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                                            📍 {household.city}{household.country && `, ${household.country}`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                            <div className="text-xs text-slate-500">
                                                {t('common.clickToEdit')}
                                            </div>
                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                {household.id !== selectedHouseholdId && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleSwitchHousehold(household.id)}
                                                        className="h-8 px-2 text-xs"
                                                    >
                                                        {t('settings.switchToHousehold')}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* SheetDialog for editing household */}
                    {selectedHousehold && (
                        <SheetDialog
                            open={sheetOpen}
                            onOpenChange={setSheetOpen}
                            title={t('settings.editHousehold')}
                            description={t('settings.editHouseholdDescription')}
                            trigger={<div style={{ display: 'none' }} />}
                        >
                            <div className="space-y-6">
                                {error && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {t('settings.householdName')} *
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder={t('settings.householdNamePlaceholder')}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {t('settings.householdAddress')}
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.address}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                            placeholder={t('settings.householdAddressPlaceholder')}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t('settings.householdCity')}
                                            </label>
                                            <input
                                                type="text"
                                                value={editForm.city}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                                                placeholder={t('settings.householdCityPlaceholder')}
                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t('settings.householdCountry')}
                                            </label>
                                            <input
                                                type="text"
                                                value={editForm.country}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                                                placeholder={t('settings.householdCountryPlaceholder')}
                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {t('settings.householdContextNotes')}
                                        </label>
                                        <textarea
                                            value={editForm.context_notes}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, context_notes: e.target.value }))}
                                            placeholder={t('settings.householdContextNotesPlaceholder')}
                                            rows={3}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            {t('settings.householdAiContext')}
                                        </label>
                                        <textarea
                                            value={editForm.ai_prompt_context}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, ai_prompt_context: e.target.value }))}
                                            placeholder={t('settings.householdAiContextPlaceholder')}
                                            rows={3}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4 border-t">
                                    <Button
                                        onClick={handleSaveEdit}
                                        disabled={savingEdit}
                                        className="flex-1"
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {savingEdit ? t('common.saving') : t('common.save')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        disabled={savingEdit}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                    {selectedHousehold.role === 'owner' && (
                                        <Button
                                            variant="destructive"
                                            onClick={handleDeleteFromSheet}
                                            disabled={savingEdit}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </SheetDialog>
                    )}
                </div>

                {/* Create Household Dialog */}
                <SheetDialog
                    open={createDialogOpen}
                    onOpenChange={setCreateDialogOpen}
                    trigger={<div style={{ display: 'none' }} />}
                    title={t('settings.createHousehold')}
                    description={t('settings.createHouseholdDescription')}
                >
                    <form onSubmit={handleCreateHousehold} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="household-name" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('settings.householdName')} *
                                </label>
                                <Input
                                    id="household-name"
                                    value={newHouseholdName}
                                    onChange={(e) => setNewHouseholdName(e.target.value)}
                                    placeholder={t('settings.householdNamePlaceholder')}
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="household-address" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('settings.householdAddress')}
                                </label>
                                <Input
                                    id="household-address"
                                    value={editForm.address}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                    placeholder={t('settings.householdAddressPlaceholder')}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="household-city" className="block text-sm font-medium text-gray-700 mb-2">
                                        {t('settings.householdCity')}
                                    </label>
                                    <Input
                                        id="household-city"
                                        value={editForm.city}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                                        placeholder={t('settings.householdCityPlaceholder')}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="household-country" className="block text-sm font-medium text-gray-700 mb-2">
                                        {t('settings.householdCountry')}
                                    </label>
                                    <Input
                                        id="household-country"
                                        value={editForm.country}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                                        placeholder={t('settings.householdCountryPlaceholder')}
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="household-context" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('settings.householdContextNotes')}
                                </label>
                                <Textarea
                                    id="household-context"
                                    value={editForm.context_notes}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, context_notes: e.target.value }))}
                                    placeholder={t('settings.householdContextNotesPlaceholder')}
                                    rows={3}
                                />
                            </div>

                            <div>
                                <label htmlFor="household-ai-context" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('settings.householdAiContext')}
                                </label>
                                <Textarea
                                    id="household-ai-context"
                                    value={editForm.ai_prompt_context}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, ai_prompt_context: e.target.value }))}
                                    placeholder={t('settings.householdAiContextPlaceholder')}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setCreateDialogOpen(false);
                                    setNewHouseholdName('');
                                    setEditForm({
                                        name: '',
                                        address: '',
                                        city: '',
                                        country: '',
                                        context_notes: '',
                                        ai_prompt_context: ''
                                    });
                                }}
                                disabled={creatingHousehold}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type="submit"
                                disabled={creatingHousehold || !newHouseholdName.trim()}
                                className="bg-primary-600 text-white hover:bg-primary-700"
                            >
                                {creatingHousehold ? t('settings.creatingHousehold') : t('settings.createHousehold')}
                            </Button>
                        </div>
                    </form>
                </SheetDialog>

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