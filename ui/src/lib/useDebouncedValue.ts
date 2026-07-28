import * as React from 'react';

/**
 * Retarde la propagation d'une valeur — une frappe au clavier ne doit pas valoir
 * une requête réseau. La valeur initiale est renvoyée immédiatement ; chaque
 * changement ultérieur attend `delay` ms de calme avant d'être publié.
 *
 * ```ts
 * const [search, setSearch] = React.useState('');
 * const debouncedSearch = useDebouncedValue(search, 300);
 * const { data } = useQuery({ queryKey: ['x', debouncedSearch], ... });
 * ```
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    if (value === debounced) return;
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
    // `debounced` est volontairement hors des deps : le relire relancerait le
    // timer à chaque publication, et la valeur ne se stabiliserait jamais.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);

  return debounced;
}
