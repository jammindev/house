import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, households, selectedHouseholdId, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const selectedHousehold = households.find(h => h.id === selectedHouseholdId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {t('dashboard.title')}
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            {t('dashboard.welcome', { name: user?.display_name || user?.email || 'User' })}
          </h2>
          {selectedHousehold && (
            <p className="mt-2 text-gray-600">
              Current household: <span className="font-medium">{selectedHousehold.name}</span>
            </p>
          )}
        </div>

        {/* Household List */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Your Households
          </h3>
          {households.length === 0 ? (
            <p className="text-gray-500">No households yet. Create one to get started!</p>
          ) : (
            <div className="space-y-3">
              {households.map((household) => (
                <div
                  key={household.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">{household.name}</h4>
                      {household.city && household.country && (
                        <p className="text-sm text-gray-500 mt-1">
                          {household.city}, {household.country}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-1">
                        {household.member_count} {household.member_count === 1 ? 'member' : 'members'}
                        {' • '}
                        <span className="capitalize">{household.user_role}</span>
                      </p>
                    </div>
                    {selectedHouseholdId === household.id && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Active
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="mt-8 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Account Information
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{user?.email}</dd>
            </div>
            {user?.display_name && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{user.display_name}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Language</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{user?.locale}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Member since</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}
              </dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  );
}
