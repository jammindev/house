import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserCheck } from 'lucide-react';
import { api } from '@/lib/axios';
import { useAuth } from '@/lib/auth/useAuth';
import { useNavigate } from 'react-router-dom';

interface UserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
}

function useAllUsers() {
  return useQuery<UserRow[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data } = await api.get<UserRow[] | { results: UserRow[] }>('/accounts/users/');
      return Array.isArray(data) ? data : data.results;
    },
  });
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const { user: me, impersonate } = useAuth();
  const navigate = useNavigate();
  const { data: users = [], isLoading } = useAllUsers();

  async function handleImpersonate(userId: string) {
    await impersonate(userId);
    navigate('/app/dashboard');
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading', 'Chargement…')}</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t('admin.users.col_email')}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t('admin.users.col_name')}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t('admin.users.col_role')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_staff ? (
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {t('admin.users.role_staff')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('admin.users.role_user')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => handleImpersonate(u.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-colors"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        {t('admin.impersonation.start')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
