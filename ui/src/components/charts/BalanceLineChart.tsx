import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { formatAmount, formatDate } from '@/lib/format';

/**
 * L'évolution d'un solde dans le temps — une courbe, ou plusieurs sur le même axe.
 *
 * Générique parce que les deux écrans de la famille argent en veulent une : la
 * fiche d'un compte (une série) et l'onglet Comptes (le total du foyer plus une
 * ligne par compte). Elles n'ont en commun que la forme — un axe de dates, des
 * montants — et c'est exactement ce qu'exprime la liste de `BalanceChartSeries`.
 *
 * Deux partis pris qui viennent du métier, pas du goût :
 *
 * 1. **`stepAfter`, jamais une courbe lissée.** Un solde tient jusqu'à ce que
 *    quelque chose le bouge. Interpoler dessinerait de l'argent arrivant petit à
 *    petit sur des jours où rien n'a bougé, et une pente se lit comme une
 *    tendance. Le serveur renvoie déjà des marches (`banking.history`) ; les
 *    aplatir ici les contredirait.
 * 2. **`unreliable` se dit, il ne se devine pas.** Une rupture dans la chaîne
 *    des soldes décale *tout le passé* de la courbe d'un même montant, sans que
 *    la forme ait l'air anormale. C'est le seul cas où un graphique parfaitement
 *    lisible est faux, donc le bandeau n'est pas une décoration.
 *
 * Les séries partagent obligatoirement le même axe de dates — c'est le serveur
 * qui le garantit (`household_series`), et rien ici ne le rattrape : deux séries
 * échantillonnées séparément ne se lisent pas l'une contre l'autre.
 */
export interface BalanceChartSeries {
  key: string;
  label: string;
  color: string;
  /** Trait plein plus épais : la série de tête (le total du foyer). */
  emphasis?: boolean;
  points: { on: string; amount: string }[];
}

interface BalanceLineChartProps {
  series: BalanceChartSeries[];
  /** Chaîne des soldes trouée : la courbe reste plausible et pourtant décalée. */
  unreliable?: boolean;
  /** Hauteur du tracé. Défaut : le format « une carte » des autres graphiques. */
  className?: string;
}

/** Tick d'axe — court, sinon douze mois de dates se chevauchent. */
function formatTick(on: string, locale: string): string {
  const date = new Date(on);
  if (Number.isNaN(date.getTime())) return on;
  return date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
}

/**
 * Borne haute « ronde » — 15 698 € donne 16 000 €, pas 20 000 €.
 *
 * Laisser recharts choisir donnait un axe montant à 18 000 € pour des données
 * qui plafonnent à 15 700 : un cinquième de la hauteur vide, donc un cinquième
 * d'amplitude perdue sur ce qu'on vient lire.
 */
function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 5;
  return Math.ceil(value / step) * step;
}

/** Graduations rondes de 0 à `top`. Cinq intervalles, pas de valeur bâtarde. */
function buildTicks(top: number): number[] {
  if (top <= 0) return [0];
  const step = top / 4;
  return [0, 1, 2, 3, 4].map((index) => index * step);
}

export default function BalanceLineChart({
  series,
  unreliable = false,
  className = 'h-64 w-full sm:h-72',
}: BalanceLineChartProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  // Un point par date, toutes séries confondues. L'axe est celui de la première
  // série : le serveur les aligne, on ne réconcilie pas ici.
  const data = React.useMemo(() => {
    const axis = series[0]?.points ?? [];
    const byKey = new Map(
      series.map((s) => [s.key, new Map(s.points.map((p) => [p.on, Number(p.amount)]))]),
    );
    return axis.map((point) => {
      const row: Record<string, string | number | null> = { on: point.on };
      for (const s of series) row[s.key] = byKey.get(s.key)?.get(point.on) ?? null;
      return row;
    });
  }, [series]);

  /**
   * L'axe des montants, ancré à zéro.
   *
   * Deux décisions y sont prises, et les deux sont du fond :
   *
   * - **Le bas est zéro, jamais le minimum des données.** Tronquer l'axe sous la
   *   plus basse valeur amplifie visuellement une variation de 2 % jusqu'à lui
   *   donner l'allure d'un effondrement. Sur un solde, c'est la déformation qui
   *   coûte le plus cher.
   * - **Un petit découvert ne redessine pas tout l'axe.** Un compte espèces à
   *   −57 € au milieu de comptes à cinq chiffres faisait descendre l'axe à
   *   −6 000 € : un tiers de la hauteur pour 0,4 % des données. Le bas descend
   *   donc *exactement* au minimum, et les graduations restent rondes à partir
   *   de zéro — la ligne de zéro suffit à dire qu'on est passé dessous.
   */
  const axis = React.useMemo(() => {
    const values = series
      .flatMap((s) => s.points.map((p) => Number(p.amount)))
      .filter((v) => Number.isFinite(v));
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const top = niceCeil(Math.max(...values, 0));
    return { domain: [Math.min(0, min), top] as [number, number], ticks: buildTicks(top) };
  }, [series]);

  // Un compte peut être à découvert : sans le zéro, une courbe entièrement
  // négative se lit comme une courbe qui monte.
  const crossesZero = React.useMemo(
    () => series.some((s) => s.points.some((p) => Number(p.amount) < 0)),
    [series],
  );

  /**
   * Une graduation par mois, prise sur le premier jour présent de ce mois.
   *
   * Sans ça, `preserveStartEnd` force le premier point *et* choisit la graduation
   * suivante par la géométrie : les deux tombaient dans le même mois et l'axe
   * affichait « août 25 » deux fois de suite.
   */
  const monthTicks = React.useMemo(() => {
    const seen = new Set<string>();
    const ticks: string[] = [];
    for (const row of data) {
      const on = String(row.on);
      const month = on.slice(0, 7);
      if (seen.has(month)) continue;
      seen.add(month);
      ticks.push(on);
    }
    return ticks;
  }, [data]);

  const seriesLabel = React.useCallback(
    (key: string) => series.find((s) => s.key === key)?.label ?? key,
    [series],
  );

  if (data.length === 0) return null;

  return (
    <div>
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="on"
              tickFormatter={(on: string) => formatTick(on, locale)}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              ticks={monthTicks}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={axis?.domain}
              ticks={axis?.ticks}
              tickFormatter={(value: number) => formatAmount(value, { fractionDigits: 0 })}
            />
            {crossesZero && <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />}
            <Tooltip
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(on) => formatDate(String(on))}
              formatter={(value, name) => [formatAmount(Number(value)), seriesLabel(String(name))]}
            />
            {series.length > 1 && (
              <Legend
                formatter={(value: string) => seriesLabel(value)}
                wrapperStyle={{ fontSize: 12 }}
              />
            )}
            {series.map((s) => (
              <Line
                key={s.key}
                type="stepAfter"
                dataKey={s.key}
                name={s.key}
                stroke={s.color}
                strokeWidth={s.emphasis ? 2.5 : 1.5}
                // Le total est la série qu'on vient lire ; les comptes disent
                // « lequel a bougé ». Les retenir en opacité sépare les deux
                // rôles même quand deux teintes se ressemblent — en clair, le
                // total (encre) et un compte foncé se confondaient.
                strokeOpacity={s.emphasis ? 1 : 0.7}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {unreliable && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('banking.history.unreliable')}
        </p>
      )}
    </div>
  );
}
