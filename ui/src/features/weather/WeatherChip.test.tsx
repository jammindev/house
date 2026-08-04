import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Weather } from '@/lib/api/weather';
import { fmtTemp, headerWeatherFrom } from './format';
import WeatherChip from './WeatherChip';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const state = vi.hoisted(() => ({ weather: null as ReturnType<typeof headerWeatherFrom> }));
vi.mock('./hooks', () => ({ useHeaderWeather: () => state.weather }));

function configured(partial: Partial<Weather> = {}): Weather {
  const current = {
    time: '2026-08-04T14:00',
    temperature: 12.4,
    apparent_temperature: 11,
    humidity: 70,
    wind_speed: 10,
    weather_code: 3,
    condition: 'cloudy' as const,
    is_day: true,
  };
  return {
    configured: true,
    location_label: 'Lille',
    units: { temperature: '°C', wind_speed: 'km/h' },
    current,
    ...partial,
  };
}

describe('headerWeatherFrom — ce que le header a le droit de dire', () => {
  it("annonce la température du foyer et son lieu", () => {
    expect(headerWeatherFrom(configured(), true)).toEqual({
      temp: '12°',
      condition: 'cloudy',
      isDay: true,
      label: 'Lille',
    });
  });

  // Le header et la page météo arrondissent le même degré : deux formatages
  // afficheraient 12° en haut et 13° dans la page, sans dire lequel croire.
  it('arrondit comme la page météo', () => {
    const data = configured({ current: { ...configured().current!, temperature: 12.6 } });

    expect(headerWeatherFrom(data, true)?.temp).toBe(fmtTemp(12.6));
    expect(headerWeatherFrom(data, true)?.temp).toBe('13°');
  });

  /**
   * Les quatre silences. Ce sont eux qui fondent le repli de la sidebar : tant
   * que le header ne dit rien, l'entrée « Météo » doit rester atteignable —
   * sinon un foyer sans localisation ne peut plus ouvrir la page où il
   * découvrirait qu'il lui en faut une.
   */
  it.each([
    ['le module est désactivé', configured(), false],
    ['aucune localisation n’est renseignée', configured({ configured: false }), true],
    ['le fournisseur est injoignable', configured({ error: true }), true],
    [
      'la température est inconnue',
      configured({ current: { ...configured().current!, temperature: null } }),
      true,
    ],
  ])('se tait quand %s', (_label, data, active) => {
    expect(headerWeatherFrom(data as Weather, active as boolean)).toBeNull();
  });
});

describe('WeatherChip', () => {
  it('mène à la page météo', () => {
    state.weather = { temp: '12°', condition: 'cloudy', isDay: true, label: 'Lille' };

    render(<MemoryRouter><WeatherChip /></MemoryRouter>);

    const chip = screen.getByTestId('header-weather');
    expect(chip).toHaveTextContent('12°');
    expect(chip).toHaveAttribute('href', '/app/weather');
  });

  it("n'occupe pas le header quand il n'a rien à dire", () => {
    state.weather = null;

    render(<MemoryRouter><WeatherChip /></MemoryRouter>);

    expect(screen.queryByTestId('header-weather')).not.toBeInTheDocument();
  });
});
