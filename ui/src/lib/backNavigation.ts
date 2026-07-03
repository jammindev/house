import { useLocation, useNavigate, type Location } from 'react-router-dom';

// Pile d'URLs d'origine portée par location.state — permet le retour vers la
// page d'où l'on vient (ex: détail projet) plutôt que vers la liste par défaut,
// y compris en chaîne (projet → tâche → note liée).
export interface BackState {
  back?: string[];
}

const MAX_STACK = 5;

function readStack(location: Location): string[] {
  const state = (location.state ?? null) as BackState | null;
  return Array.isArray(state?.back) ? state.back : [];
}

/**
 * À passer en `state` d'un `<Link>` (ou de `navigate()`) qui mène vers une page
 * de détail : empile l'URL courante pour que le bouton retour y revienne.
 *
 *   const location = useLocation();
 *   <Link to={`/app/tasks/${id}`} state={pushBack(location)}>
 */
export function pushBack(location: Location): BackState {
  const stack = readStack(location);
  return { back: [...stack, location.pathname + location.search].slice(-MAX_STACK) };
}

/**
 * Cible de retour de la page courante : l'origine empilée si présente, sinon
 * le fallback. `state` dépile pour que la page cible retrouve sa propre origine.
 */
export function useBackTarget(fallback: string): {
  to: string;
  state: BackState;
  hasOrigin: boolean;
} {
  const location = useLocation();
  const stack = readStack(location);
  if (stack.length === 0) return { to: fallback, state: {}, hasOrigin: false };
  return {
    to: stack[stack.length - 1],
    state: { back: stack.slice(0, -1) },
    hasOrigin: true,
  };
}

/** Navigation programmatique vers la cible de retour (ex: après suppression). */
export function useNavigateBack(fallback: string): () => void {
  const navigate = useNavigate();
  const { to, state } = useBackTarget(fallback);
  return () => navigate(to, { state });
}
