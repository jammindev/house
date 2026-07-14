import * as React from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/design-system/input';
import { geocodePlace, type GeocodeResult } from '@/lib/api/weather';

export interface WeatherLocation {
  location_label: string;
  latitude: number;
  longitude: number;
}

interface Props {
  label: string;
  latitude: number | null;
  longitude: number | null;
  onSelect: (location: WeatherLocation) => void;
  onClear: () => void;
}

function formatResult(r: GeocodeResult): string {
  return [r.name, r.admin1, r.country].filter(Boolean).join(', ');
}

/**
 * City search backed by Open-Meteo geocoding (proxied by the backend). Picking a
 * result fills the household latitude/longitude + a human-readable label — the
 * single input the weather module needs. Debounced; min 2 characters.
 */
export default function WeatherLocationField({ label, latitude, longitude, onSelect, onClear }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<GeocodeResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const found = await geocodePlace(q);
        if (!cancelled) {
          setResults(found);
          setSearched(true);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const hasLocation = label !== '' && latitude !== null && longitude !== null;

  function pick(r: GeocodeResult) {
    onSelect({ location_label: formatResult(r), latitude: r.latitude, longitude: r.longitude });
    setQuery('');
    setResults([]);
    setSearched(false);
  }

  return (
    <div className="space-y-2">
      {hasLocation && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{label}</span>
          </span>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={t('weather.location.clear')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('weather.location.searchPlaceholder')}
          className="pl-8"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-md">
            {results.map((r) => (
              <li key={`${r.latitude},${r.longitude}`}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{formatResult(r)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {searching && <p className="text-xs text-muted-foreground">{t('weather.location.searching')}</p>}
      {!searching && searched && results.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('weather.location.noResults')}</p>
      )}
    </div>
  );
}
