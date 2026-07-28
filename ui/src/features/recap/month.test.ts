import { describe, expect, it } from 'vitest';
import { monthLabel } from './month';

describe('monthLabel', () => {
  it('labels a month from its parts, never by parsing the string as a date', () => {
    // `new Date('2026-01')` parses as UTC midnight, which is December 31st in any
    // negative-offset zone — the label would name the wrong month, and the wrong
    // year. Same trap as `toISOString()` on the other side (see lib/format).
    expect(monthLabel('2026-01')).toMatch(/2026/);
    expect(monthLabel('2026-01')).not.toMatch(/2025/);
  });

  it('keeps the month and the year of what it was given', () => {
    const label = monthLabel('2026-07');
    expect(label).toMatch(/2026/);
    // July in the four supported locales, plus the English fallback.
    expect(label.toLowerCase()).toMatch(/juillet|july|juli|julio/);
  });

  it('handles December without rolling into the next year', () => {
    expect(monthLabel('2026-12')).toMatch(/2026/);
    expect(monthLabel('2026-12')).not.toMatch(/2027/);
  });

  it('degrades to the raw value rather than throwing on malformed input', () => {
    expect(monthLabel('not-a-month')).toBe('not-a-month');
    expect(monthLabel('')).toBe('');
    expect(monthLabel(undefined)).toBe('');
  });
});
