import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Par défaut ('online'), une mutation soumise hors-ligne est mise en pause :
      // la promesse ne settle jamais, isPending reste true et aucun onError ne
      // s'exécute — dialog figé sans message. 'always' la fait échouer immédiatement.
      networkMode: 'always',
    },
  },
});
