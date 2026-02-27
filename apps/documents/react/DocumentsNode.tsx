import { useTranslation } from 'react-i18next';

type DocumentsNodeProps = {
  section?: string;
};

export default function DocumentsNode({ section = 'documents' }: DocumentsNodeProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">{t('documents.app_title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('documents.section_label', { section })}</p>
    </section>
  );
}
