import { useTranslation } from 'react-i18next';

type ProjectsNodeProps = {
  section?: string;
};

export default function ProjectsNode({ section = 'projects' }: ProjectsNodeProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-card-foreground">
      <h2 className="text-lg font-semibold">{t('projects.app_title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('projects.section_label', { section })}</p>
    </section>
  );
}
