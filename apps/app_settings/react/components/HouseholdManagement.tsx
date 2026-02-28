import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/design-system/card';
import { Alert, AlertDescription } from '@/design-system/alert';
import type { Household } from '@/lib/api/households';
import {
  fetchHouseholds,
  createHousehold,
  updateHousehold,
  deleteHousehold,
  leaveHousehold,
  inviteMember,
} from '@/lib/api/households';

interface HouseholdManagementProps {
  initialHouseholds: Household[];
  currentUserId: string;
}

export function HouseholdManagement({
  initialHouseholds,
  currentUserId,
}: HouseholdManagementProps) {
  const { t } = useTranslation();

  const [households, setHouseholds] = React.useState<Household[]>(initialHouseholds);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Create new household
  const [newName, setNewName] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  // Edit household
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editSaving, setEditSaving] = React.useState(false);

  // Invite
  const [invitingId, setInvitingId] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviting, setInviting] = React.useState(false);

  function flash(msg: string, isError = false) {
    if (isError) {
      setError(msg);
      setSuccess(null);
    } else {
      setSuccess(msg);
      setError(null);
    }
    setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 4000);
  }

  async function reload() {
    try {
      const data = await fetchHouseholds();
      setHouseholds(data);
    } catch {
      // silent refresh failure
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      flash(t('settings.householdNameRequired'), true);
      return;
    }
    setCreating(true);
    try {
      await createHousehold({ name: trimmed });
      setNewName('');
      await reload();
      flash(t('settings.householdCreated'));
    } catch {
      flash(t('settings.householdCreateFailed'), true);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('common.confirmDelete', { defaultValue: 'Are you sure?' }))) return;
    setLoading(true);
    try {
      await deleteHousehold(id);
      await reload();
      flash(t('settings.householdDeleted'));
    } catch {
      flash(t('settings.requestFailed', { defaultValue: 'Request failed.' }), true);
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave(id: string) {
    if (!confirm(t('common.confirmLeave', { defaultValue: 'Leave this household?' }))) return;
    setLoading(true);
    try {
      await leaveHousehold(id);
      await reload();
      flash(t('settings.householdLeft', { defaultValue: 'Left household.' }));
    } catch {
      flash(t('settings.requestFailed', { defaultValue: 'Request failed.' }), true);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(h: Household) {
    setEditingId(h.id);
    setEditName(h.name);
  }

  async function handleEditSave(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setEditSaving(true);
    try {
      await updateHousehold(id, { name: trimmed });
      await reload();
      setEditingId(null);
      flash(t('settings.householdUpdated', { defaultValue: 'Household updated.' }));
    } catch {
      flash(t('settings.requestFailed', { defaultValue: 'Request failed.' }), true);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!invitingId || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await inviteMember(invitingId, inviteEmail.trim());
      setInviteEmail('');
      setInvitingId(null);
      await reload();
      flash(t('settings.memberInvited', { defaultValue: 'Member invited.' }));
    } catch {
      flash(t('settings.inviteFailed', { defaultValue: 'Failed to invite member.' }), true);
    } finally {
      setInviting(false);
    }
  }

  const isOwner = (h: Household) =>
    h.members?.some((m) => m.user === currentUserId && m.role === 'owner') ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.householdsTitle', { defaultValue: 'Households' })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Household list */}
        {households.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('settings.noHouseholds', { defaultValue: 'No households yet.' })}
          </p>
        ) : (
          <ul className="space-y-3">
            {households.map((h) => (
              <li key={h.id} className="rounded-lg border p-3 space-y-2">
                {editingId === h.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => void handleEditSave(h.id)}
                      disabled={editSaving}
                    >
                      {editSaving ? t('settings.saving', { defaultValue: 'Saving…' }) : t('common.save', { defaultValue: 'Save' })}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{h.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {h.members_count} {t('settings.members', { defaultValue: 'members' })}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {isOwner(h) && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => startEdit(h)}>
                            {t('common.edit', { defaultValue: 'Edit' })}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setInvitingId(h.id); setInviteEmail(''); }}
                          >
                            {t('settings.invite', { defaultValue: 'Invite' })}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => void handleDelete(h.id)}
                            disabled={loading}
                          >
                            {t('common.delete', { defaultValue: 'Delete' })}
                          </Button>
                        </>
                      )}
                      {!isOwner(h) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleLeave(h.id)}
                          disabled={loading}
                        >
                          {t('settings.leave', { defaultValue: 'Leave' })}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Members */}
                {h.members && h.members.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 pl-2 border-l">
                    {h.members.map((m) => (
                      <li key={`${m.household}-${m.user}`}>
                        {m.user_email}
                        {m.user_display_name ? ` (${m.user_display_name})` : ''}
                        {' — '}
                        <span className="capitalize">{m.role}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Invite form */}
                {invitingId === h.id && (
                  <form onSubmit={(e) => void handleInvite(e)} className="flex gap-2 pt-1">
                    <Input
                      type="email"
                      placeholder={t('settings.inviteEmailPlaceholder', { defaultValue: 'member@example.com' })}
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button type="submit" size="sm" disabled={inviting}>
                      {inviting ? t('settings.sending', { defaultValue: 'Sending…' }) : t('settings.send', { defaultValue: 'Send' })}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setInvitingId(null)} type="button">
                      {t('common.cancel', { defaultValue: 'Cancel' })}
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Create household form */}
        <form onSubmit={(e) => void handleCreate(e)} className="flex gap-2 pt-2 border-t">
          <Input
            placeholder={t('settings.householdNamePlaceholder', { defaultValue: 'New household name' })}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={creating}>
            {creating ? t('settings.creating', { defaultValue: 'Creating…' }) : t('settings.createHousehold', { defaultValue: 'Create' })}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
