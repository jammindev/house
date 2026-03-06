import * as React from 'react';
import { Mail, Phone, MapPin, Building2, Edit, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import { fetchContact, fetchContactInteractions, type Contact } from '@/lib/api/contacts';
import ContactDeleteButton from './ContactDeleteButton';

interface Interaction {
  id: string;
  type: string;
  subject?: string | null;
  content?: string | null;
  occurred_at?: string | null;
}

interface ContactDetailsViewProps {
  contactId: string;
  householdId?: string | null;
  editUrl?: string;
  backUrl?: string;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{children}</h2>;
}

export default function ContactDetailsView({
  contactId,
  editUrl,
  backUrl = '/app/directory/?view=contacts',
}: ContactDetailsViewProps) {
  const { t } = useTranslation();
  const [contact, setContact] = React.useState<Contact | null>(null);
  const [interactions, setInteractions] = React.useState<Interaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const resolvedEditUrl = editUrl ?? `/app/directory/contacts/${contactId}/edit/`;

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchContact(contactId),
      fetchContactInteractions(contactId),
    ])
      .then(([c, ixs]) => {
        if (!cancelled) {
          setContact(c);
          setInteractions(ixs as unknown as Interaction[]);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('contacts.loadFailed', { defaultValue: 'Failed to load contact.' }));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [contactId, t]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>;
  }

  if (error || !contact) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
        {error ?? t('contacts.notFound', { defaultValue: 'Contact not found.' })}
      </div>
    );
  }

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || t('contacts.noName', { defaultValue: 'Unnamed contact' });

  return (
    <div className="max-w-2xl space-y-8">
      {/* Back + Actions */}
      <div className="flex items-center justify-between gap-4">
        <a href={backUrl} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          {t('common.back', { defaultValue: 'Back' })}
        </a>
        <div className="flex gap-2">
          <a href={resolvedEditUrl} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Edit className="mr-1.5 h-4 w-4" aria-hidden />
            {t('common.edit', { defaultValue: 'Edit' })}
          </a>
          <ContactDeleteButton contactId={contactId} contactName={fullName} />
        </div>
      </div>

      {/* Identity */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
        {contact.position && (
          <p className="mt-1 text-sm text-gray-500">{contact.position}</p>
        )}
        {contact.structure && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-600">
            <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
            <span>{contact.structure.name}</span>
          </div>
        )}
      </div>

      {/* Emails */}
      {contact.emails && contact.emails.length > 0 && (
        <section aria-label={t('contacts.emails', { defaultValue: 'Emails' })}>
          <SectionTitle>{t('contacts.emails', { defaultValue: 'Emails' })}</SectionTitle>
          <ul className="space-y-2">
            {contact.emails.map((em) => (
              <li key={em.id} className="flex items-center gap-3">
                <Mail className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
                <a href={`mailto:${em.email}`} className="text-sm text-blue-600 hover:underline">
                  {em.email}
                </a>
                {em.label && (
                  <Badge variant="outline" className="text-xs">{em.label}</Badge>
                )}
                {em.is_primary && (
                  <Badge variant="secondary" className="text-xs">
                    {t('contacts.primary', { defaultValue: 'Primary' })}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Phones */}
      {contact.phones && contact.phones.length > 0 && (
        <section aria-label={t('contacts.phones', { defaultValue: 'Phones' })}>
          <SectionTitle>{t('contacts.phones', { defaultValue: 'Phones' })}</SectionTitle>
          <ul className="space-y-2">
            {contact.phones.map((ph) => (
              <li key={ph.id} className="flex items-center gap-3">
                <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
                <a href={`tel:${ph.phone}`} className="text-sm text-blue-600 hover:underline">
                  {ph.phone}
                </a>
                {ph.label && (
                  <Badge variant="outline" className="text-xs">{ph.label}</Badge>
                )}
                {ph.is_primary && (
                  <Badge variant="secondary" className="text-xs">
                    {t('contacts.primary', { defaultValue: 'Primary' })}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Addresses */}
      {contact.addresses && contact.addresses.length > 0 && (
        <section aria-label={t('contacts.addresses', { defaultValue: 'Addresses' })}>
          <SectionTitle>{t('contacts.addresses', { defaultValue: 'Addresses' })}</SectionTitle>
          <ul className="space-y-3">
            {contact.addresses.map((addr) => (
              <li key={addr.id} className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
                <div className="text-sm">
                  {addr.address_1 && <p>{addr.address_1}</p>}
                  {addr.address_2 && <p>{addr.address_2}</p>}
                  {(addr.city || addr.zipcode) && (
                    <p>{[addr.zipcode, addr.city].filter(Boolean).join(' ')}</p>
                  )}
                  {addr.country && <p className="text-gray-500">{addr.country}</p>}
                </div>
                {addr.label && (
                  <Badge variant="outline" className="text-xs">{addr.label}</Badge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Notes */}
      {contact.notes && (
        <section aria-label={t('contacts.notes', { defaultValue: 'Notes' })}>
          <SectionTitle>{t('contacts.notes', { defaultValue: 'Notes' })}</SectionTitle>
          <p className="whitespace-pre-line text-sm text-gray-700">{contact.notes}</p>
        </section>
      )}

      {/* Recent interactions */}
      <section aria-label={t('interactions.recentTitle', { defaultValue: 'Recent interactions' })}>
        <SectionTitle>{t('interactions.recentTitle', { defaultValue: 'Recent interactions' })}</SectionTitle>
        {interactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('interactions.noInteractions', { defaultValue: 'No interactions yet.' })}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
            {interactions.map((ix) => (
              <li key={ix.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {ix.subject ?? ix.type}
                  </p>
                  {ix.content && (
                    <p className="truncate text-xs text-gray-500">{ix.content}</p>
                  )}
                </div>
                {ix.occurred_at && (
                  <span className="flex-shrink-0 text-xs text-gray-400">{formatDate(ix.occurred_at)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
        <a href={`/app/interactions/?contact=${contactId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              {t('interactions.viewAll', { defaultValue: 'View all interactions' })}
            </a>
        </div>
      </section>

      {/* Audit */}
      <footer className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-100">
        {contact.created_at && (
          <p>{t('common.createdAt', { defaultValue: 'Created' })}: {formatDate(contact.created_at)}</p>
        )}
        {contact.updated_at && (
          <p>{t('common.updatedAt', { defaultValue: 'Updated' })}: {formatDate(contact.updated_at)}</p>
        )}
      </footer>
    </div>
  );
}
