import * as React from 'react';
import { ArrowLeft, Edit, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buttonVariants } from '@/design-system/button';
import { Badge } from '@/design-system/badge';
import { fetchStructure, fetchStructureInteractions, type Structure } from '@/lib/api/structures';
import StructureDeleteButton from './StructureDeleteButton';

interface Interaction {
  id: string;
  type: string;
  subject?: string | null;
  content?: string | null;
  occurred_at?: string | null;
}

interface StructureDetailViewProps {
  structureId: string;
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

export default function StructureDetailView({
  structureId,
  editUrl,
  backUrl = '/app/directory/?view=structures',
}: StructureDetailViewProps) {
  const { t } = useTranslation();
  const [structure, setStructure] = React.useState<Structure | null>(null);
  const [interactions, setInteractions] = React.useState<Interaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const resolvedEditUrl = editUrl ?? `/app/directory/structures/${structureId}/edit/`;

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchStructure(structureId),
      fetchStructureInteractions(structureId),
    ])
      .then(([s, ixs]) => {
        if (!cancelled) {
          setStructure(s);
          setInteractions(ixs as unknown as Interaction[]);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('structures.loadFailed', { defaultValue: 'Failed to load structure.' }));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [structureId, t]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</p>;
  }

  if (error || !structure) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
        {error ?? t('structures.notFound', { defaultValue: 'Structure not found.' })}
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
          <StructureDeleteButton structureId={structureId} structureName={structure.name} />
        </div>
      </div>

      {/* Identity */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{structure.name}</h1>
          {structure.type && (
            <Badge variant="secondary">{t(`structures.types.${structure.type}`, { defaultValue: structure.type })}</Badge>
          )}
        </div>
        {structure.website && (
          <div className="mt-2 flex items-center gap-1.5 text-sm">
            <Globe className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
            <a
              href={structure.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline break-all"
            >
              {structure.website}
            </a>
          </div>
        )}
        {structure.description && (
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{structure.description}</p>
        )}
      </div>

      {/* Emails */}
      {structure.emails && structure.emails.length > 0 && (
        <section aria-label={t('contacts.emails', { defaultValue: 'Emails' })}>
          <SectionTitle>{t('contacts.emails', { defaultValue: 'Emails' })}</SectionTitle>
          <ul className="space-y-2">
            {structure.emails.map((em) => (
              <li key={em.id} className="flex items-center gap-3">
                <Mail className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
                <a href={`mailto:${em.email}`} className="text-sm text-blue-600 hover:underline">{em.email}</a>
                {em.label && <Badge variant="outline" className="text-xs">{em.label}</Badge>}
                {em.is_primary && <Badge variant="secondary" className="text-xs">{t('contacts.primary', { defaultValue: 'Primary' })}</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Phones */}
      {structure.phones && structure.phones.length > 0 && (
        <section aria-label={t('contacts.phones', { defaultValue: 'Phones' })}>
          <SectionTitle>{t('contacts.phones', { defaultValue: 'Phones' })}</SectionTitle>
          <ul className="space-y-2">
            {structure.phones.map((ph) => (
              <li key={ph.id} className="flex items-center gap-3">
                <Phone className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden />
                <a href={`tel:${ph.phone}`} className="text-sm text-blue-600 hover:underline">{ph.phone}</a>
                {ph.label && <Badge variant="outline" className="text-xs">{ph.label}</Badge>}
                {ph.is_primary && <Badge variant="secondary" className="text-xs">{t('contacts.primary', { defaultValue: 'Primary' })}</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Addresses */}
      {structure.addresses && structure.addresses.length > 0 && (
        <section aria-label={t('contacts.addresses', { defaultValue: 'Addresses' })}>
          <SectionTitle>{t('contacts.addresses', { defaultValue: 'Addresses' })}</SectionTitle>
          <ul className="space-y-3">
            {structure.addresses.map((addr) => (
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
                {addr.label && <Badge variant="outline" className="text-xs">{addr.label}</Badge>}
              </li>
            ))}
          </ul>
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
                  <p className="truncate text-sm font-medium text-gray-900">{ix.subject ?? ix.type}</p>
                  {ix.content && <p className="truncate text-xs text-gray-500">{ix.content}</p>}
                </div>
                {ix.occurred_at && (
                  <span className="flex-shrink-0 text-xs text-gray-400">{formatDate(ix.occurred_at)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <a href={`/app/interactions/?structure=${structureId}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            {t('interactions.viewAll', { defaultValue: 'View all interactions' })}
          </a>
        </div>
      </section>

      {/* Audit */}
      <footer className="text-xs text-gray-400 space-y-1 pt-2 border-t border-gray-100">
        {structure.created_at && (
          <p>{t('common.createdAt', { defaultValue: 'Created' })}: {formatDate(structure.created_at)}</p>
        )}
        {structure.updated_at && (
          <p>{t('common.updatedAt', { defaultValue: 'Updated' })}: {formatDate(structure.updated_at)}</p>
        )}
      </footer>
    </div>
  );
}
