import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Trash2 } from 'lucide-react';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Select } from '@/design-system/select';
import { FormField } from '@/design-system/form-field';
import { useHouseholdInvitations, useRevokeInvitation } from '../../../hooks';
import type { InvitationLink } from '@/lib/api/households';

/** Copy to clipboard, falling back to a hidden textarea on insecure origins. */
async function copyToClipboard(text: string): Promise<boolean> {
  // navigator.clipboard is undefined outside a secure context — which includes
  // reaching the dev server by LAN IP, the very case where you test invitations
  // from a phone.
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through */
    }
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function CopyLinkButton({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (await copyToClipboard(url)) setCopied(true);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()} className="shrink-0">
      {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
      {copied ? t('invitations.copied') : t('invitations.copyLink')}
    </Button>
  );
}

function InvitationRow({
  invitation,
  householdId,
  highlight,
}: {
  invitation: InvitationLink;
  householdId: string;
  highlight: boolean;
}) {
  const { t, i18n } = useTranslation();
  const revokeMutation = useRevokeInvitation();

  const expires = new Date(invitation.expires_at).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
  });

  return (
    <div
      data-testid="invitation-row"
      className={`space-y-2 rounded-lg border p-3 ${highlight ? 'border-primary bg-primary/5' : 'border-border'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-sm font-medium">
            {invitation.email || t('invitations.openLink')}
          </p>
          <p className="text-xs text-muted-foreground">
            {invitation.is_expired
              ? t('invitations.expired')
              : t('invitations.expiresOn', { date: expires })}
            {invitation.role === 'owner' && ` — ${t('settings.owner')}`}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={t('invitations.revoke')}
          title={t('invitations.revoke')}
          disabled={revokeMutation.isPending}
          onClick={() => revokeMutation.mutate({ householdId, invitationId: invitation.id })}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          {invitation.join_url}
        </code>
        <CopyLinkButton url={invitation.join_url} />
      </div>

      {invitation.has_account && (
        <p className="text-xs text-muted-foreground">{t('invitations.alsoNotifiedInApp')}</p>
      )}
    </div>
  );
}

interface InvitePanelProps {
  householdId: string;
  email: string;
  role: 'owner' | 'member';
  inviting: boolean;
  onSetEmail: (value: string) => void;
  onSetRole: (value: 'owner' | 'member') => void;
  onSubmit: (event: React.FormEvent, householdId: string) => Promise<void>;
  onClose: () => void;
  /** Invitation just created in this session — highlighted so the link is obvious. */
  lastCreatedId: string | null;
}

/**
 * Invite panel. An invitation is a **link the owner shares themselves** — the
 * server sends no mail, so the panel's job is to hand over a URL, not to
 * announce that something was sent.
 */
export function InvitePanel({
  householdId,
  email,
  role,
  inviting,
  onSetEmail,
  onSetRole,
  onSubmit,
  onClose,
  lastCreatedId,
}: InvitePanelProps) {
  const { t } = useTranslation();
  const { data: invitations = [], isLoading } = useHouseholdInvitations(householdId);

  return (
    <div className="space-y-4 pt-1">
      <form onSubmit={(event) => void onSubmit(event, householdId)} className="space-y-3">
        <FormField label={t('invitations.emailOptional')} htmlFor={`invite-email-${householdId}`}>
          <Input
            id={`invite-email-${householdId}`}
            type="email"
            placeholder={t('settings.inviteEmailPlaceholder')}
            value={email}
            onChange={(event) => onSetEmail(event.target.value)}
            className="w-full"
            autoFocus
          />
          <p className="pt-1 text-xs text-muted-foreground">{t('invitations.emailOptionalHint')}</p>
        </FormField>

        <FormField label={t('invitations.role')} htmlFor={`invite-role-${householdId}`}>
          <Select
            id={`invite-role-${householdId}`}
            value={role}
            onChange={(event) => onSetRole(event.target.value as 'owner' | 'member')}
            options={[
              { value: 'member', label: t('settings.member') },
              { value: 'owner', label: t('settings.owner') },
            ]}
          />
        </FormField>

        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose} type="button">
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={inviting}>
            {inviting ? t('common.saving') : t('invitations.createLink')}
          </Button>
        </div>
      </form>

      {!isLoading && invitations.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {t('invitations.pendingLinks', { count: invitations.length })}
          </p>
          {invitations.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              householdId={householdId}
              highlight={invitation.id === lastCreatedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
