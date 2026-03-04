import type { Zone } from '../types/zones';

export const ROOT_ZONE_COLOR = '#f4f4f5';
export const DEFAULT_FIRST_LEVEL_COLOR = '#60A5FA';
export const ZONE_LIGHTEN_FACTOR = 0.14;

const HEX_COLOR_REGEX = /^#?([0-9a-f]{6})$/i;

export function normalizeHexColor(value: string | null | undefined, fallback = DEFAULT_FIRST_LEVEL_COLOR): string {
  if (!value) return fallback;
  const match = value.match(HEX_COLOR_REGEX);
  if (!match) return fallback;
  return `#${match[1].toUpperCase()}`;
}

function normalizeFactor(factor: number | null | undefined) {
  if (typeof factor !== 'number' || Number.isNaN(factor)) return ZONE_LIGHTEN_FACTOR;
  return Math.min(1, Math.max(0, factor));
}

function lightenChannel(channel: number, factor: number) {
  return Math.min(255, Math.round(channel + (255 - channel) * factor));
}

export function lightenHexColor(hex: string, factor: number = ZONE_LIGHTEN_FACTOR): string {
  const normalized = normalizeHexColor(hex);
  const clean = normalized.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const pct = normalizeFactor(factor);
  const next = [lightenChannel(r, pct), lightenChannel(g, pct), lightenChannel(b, pct)];
  return `#${next.map((val) => val.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function getZoneDisplayColor(zone: Zone, zonesById: Map<string, Zone>, memo = new Map<string, string>()): string {
  if (memo.has(zone.id)) {
    return memo.get(zone.id)!;
  }

  let color: string;
  if (!zone.parent_id) {
    color = ROOT_ZONE_COLOR;
  } else {
    const parent = zonesById.get(zone.parent_id);
    if (!parent || !parent.parent_id) {
      color = normalizeHexColor(zone.color);
    } else {
      const parentColor = getZoneDisplayColor(parent, zonesById, memo);
      color = lightenHexColor(parentColor);
    }
  }

  memo.set(zone.id, color);
  return color;
}
