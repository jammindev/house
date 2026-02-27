import { useTranslation } from 'react-i18next';

type SettingsNodeProps = {
  section?: string;
};

export default function SettingsNode({ section = 'settings' }: SettingsNodeProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">{t('settings.app_title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('settings.section_label', { section })}</p>
    </section>
  );
}
