import { useState, useEffect } from 'react';

/**
 * Évite le flash du skeleton quand la donnée arrive rapidement.
 * N'affiche le skeleton qu'après `delay` ms — si la donnée arrive avant, rien ne s'affiche.
 */
export function useDelayedLoading(loading: boolean, delay = 200): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [loading, delay]);

  return show;
}
