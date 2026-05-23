import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/design-system/button';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <Compass className="h-10 w-10 text-muted-foreground/40" aria-hidden />
      <div>
        <h1 className="text-lg font-semibold text-foreground">{t('errors.notFoundTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('errors.notFoundDescription')}</p>
      </div>
      <Link to="/app/dashboard" className={cn(buttonVariants({ size: 'sm' }))}>
        {t('errors.backToDashboard')}
      </Link>
    </div>
  );
}
