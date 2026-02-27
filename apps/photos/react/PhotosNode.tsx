import { useTranslation } from 'react-i18next';

type PhotosNodeProps = {
  section?: string;
};

export default function PhotosNode({ section = 'photos' }: PhotosNodeProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">{t('photos.app_title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('photos.section_label', { section })}</p>
    </section>
  );
}
