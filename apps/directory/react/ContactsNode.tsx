import { useTranslation } from 'react-i18next';

type ContactsNodeProps = {
  section?: string;
};

export default function ContactsNode({ section = 'contacts' }: ContactsNodeProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">{t('contacts.app_title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('contacts.section_label', { section })}</p>
    </section>
  );
}
