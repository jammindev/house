import * as React from 'react';
import { Building2, Plus, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/design-system/button';
import { fetchContacts, type Contact } from '@/lib/api/contacts';
import { fetchStructures, type Structure } from '@/lib/api/structures';
import { useHouseholdId } from '@/lib/useHouseholdId';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ContactList from './ContactList';
import StructureList from './StructureList';
import { cn } from '@/lib/utils';

type DirectoryView = 'contacts' | 'structures';

interface DirectoryPageProps {
  initialView?: string;
}

function getCurrentView(): DirectoryView {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  return view === 'structures' ? 'structures' : 'contacts';
}

function setViewParam(view: DirectoryView) {
  const params = new URLSearchParams(window.location.search);
  params.set('view', view);
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

export default function DirectoryPage({ initialView: _initialView }: DirectoryPageProps) {
  const householdId = useHouseholdId();
  const { t } = useTranslation();
  const [currentView, setCurrentView] = React.useState<DirectoryView>(getCurrentView);

  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = React.useState(true);
  const [contactsError, setContactsError] = React.useState<string | null>(null);

  const [structures, setStructures] = React.useState<Structure[]>([]);
  const [structuresLoading, setStructuresLoading] = React.useState(true);
  const [structuresError, setStructuresError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setContactsLoading(true);
    fetchContacts(householdId)
      .then((list) => { if (!cancelled) { setContacts(list); setContactsLoading(false); } })
      .catch(() => { if (!cancelled) { setContactsError(t('contacts.loadFailed', { defaultValue: 'Failed to load contacts.' })); setContactsLoading(false); } });
    return () => { cancelled = true; };
  }, [householdId, t]);

  React.useEffect(() => {
    let cancelled = false;
    setStructuresLoading(true);
    fetchStructures(householdId)
      .then((list) => { if (!cancelled) { setStructures(list); setStructuresLoading(false); } })
      .catch(() => { if (!cancelled) { setStructuresError(t('structures.loadFailed', { defaultValue: 'Failed to load structures.' })); setStructuresLoading(false); } });
    return () => { cancelled = true; };
  }, [householdId, t]);

  // Clean up URL params after redirect notifications
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    if (params.has('created')) { params.delete('created'); changed = true; }
    if (params.has('deleted')) { params.delete('deleted'); changed = true; }
    if (changed) {
      if (!params.has('view')) params.set('view', currentView);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [currentView]);

  function navigateWithView(view: DirectoryView) {
    setCurrentView(view);
    setViewParam(view);
  }

  function handleSelectContact(contact: Contact) {
    window.location.href = `/app/directory/contacts/${contact.id}/`;
  }

  function handleSelectStructure(structure: Structure) {
    window.location.href = `/app/directory/structures/${structure.id}/`;
  }

  const isContacts = currentView === 'contacts';
  const loading = isContacts ? contactsLoading : structuresLoading;
  const error = isContacts ? contactsError : structuresError;

  return (
    <div className="space-y-6">
      <PageHeader title={t('repertoire.title', { defaultValue: 'Directory' })}>
        <a
          href={isContacts ? '/app/directory/contacts/new/' : '/app/directory/structures/new/'}
          className={cn(buttonVariants({ size: 'sm' }))}
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          {isContacts
            ? t('contacts.addContact', { defaultValue: 'Add contact' })
            : t('structures.addStructure', { defaultValue: 'Add structure' })}
        </a>
      </PageHeader>

      <div className="flex justify-end">
        <div className="inline-flex gap-2">
          <Button
            type="button"
            variant={currentView === 'contacts' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigateWithView('contacts')}
            aria-pressed={currentView === 'contacts'}
          >
            {t('repertoire.contactsTab', { defaultValue: 'Contacts' })}
          </Button>
          <Button
            type="button"
            variant={currentView === 'structures' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => navigateWithView('structures')}
            aria-pressed={currentView === 'structures'}
          >
            {t('repertoire.structuresTab', { defaultValue: 'Structures' })}
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">
          {t('common.loading', { defaultValue: 'Loading…' })}
        </p>
      )}

      {!loading && error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && isContacts && contacts.length === 0 && (
        <EmptyState
          icon={UserPlus}
          title={t('contacts.empty', { defaultValue: 'No contacts yet.' })}
          description={t('contacts.createDescription', { defaultValue: 'Add your first contact to get started.' })}
          action={{ label: t('contacts.addContact', { defaultValue: 'Add contact' }), href: '/app/directory/contacts/new/' }}
        />
      )}

      {!loading && !error && !isContacts && structures.length === 0 && (
        <EmptyState
          icon={Building2}
          title={t('structures.empty', { defaultValue: 'No structures yet.' })}
          description={t('structures.createDescription', { defaultValue: 'Add your first structure to get started.' })}
          action={{ label: t('structures.addStructure', { defaultValue: 'Add structure' }), href: '/app/directory/structures/new/' }}
        />
      )}

      {!loading && !error && isContacts && contacts.length > 0 && (
        <ContactList contacts={contacts} onSelect={handleSelectContact} />
      )}

      {!loading && !error && !isContacts && structures.length > 0 && (
        <StructureList structures={structures} onSelect={handleSelectStructure} />
      )}
    </div>
  );
}
