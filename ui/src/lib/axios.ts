import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('_impersonator_tokens');
  window.location.href = '/login';
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (!refresh) {
        logout();
      } else {
        try {
          const { data } = await axios.post('/api/auth/token/refresh/', { refresh });
          localStorage.setItem('access_token', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch (refreshError) {
          // Ne déconnecter que si le serveur a réellement refusé le refresh token.
          // Sans réponse (coupure réseau pendant le refresh), la session est
          // peut-être encore valide — on laisse l'erreur d'origine remonter.
          if (axios.isAxiosError(refreshError) && refreshError.response) {
            logout();
          }
        }
      }
    }
    return Promise.reject(error);
  }
);
