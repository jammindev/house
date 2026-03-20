import { UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth/useAuth';

export default function ImpersonationBanner() {
  const { t } = useTranslation();
  const { user, isImpersonating, stopImpersonation } = useAuth();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('_impersonator_tokens') ?? '{}'); }
    catch { return {}; }
  })();

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-orange-500 text-white text-sm font-medium shrink-0">
      <div className="flex items-center gap-2">
        <UserX className="h-4 w-4 shrink-0" />
        <span>
          {t('admin.impersonation.banner', { email: user?.email })}
          {saved.adminEmail && (
            <span className="opacity-80 ml-1">
              ({t('admin.impersonation.as', { email: saved.adminEmail })})
            </span>
          )}
        </span>
      </div>
      <button
        onClick={async () => { await stopImpersonation(); navigate('/'); }}
        className="shrink-0 underline underline-offset-2 hover:no-underline"
      >
        {t('admin.impersonation.stop')}
      </button>
    </div>
  );
}
