import { describe, it, expect } from 'vitest';
import { toPlainText } from './plainText';

describe('toPlainText', () => {
  it('strips HTML tags (Telegram digest bold)', () => {
    expect(toPlainText('<b>Briefing du matin</b> Électricité')).toBe(
      'Briefing du matin Électricité',
    );
  });

  it('decodes HTML entities', () => {
    expect(toPlainText('Wood &amp; Co &lt;pro&gt;')).toBe('Wood & Co <pro>');
  });

  it('removes markdown emphasis markers', () => {
    expect(toPlainText('**Résumé** du _jour_ et `code`')).toBe('Résumé du jour et code');
  });

  it('strips heading, blockquote and list markers', () => {
    expect(toPlainText('# Titre\n> cite\n- item')).toBe('Titre cite item');
  });

  it('keeps markdown link text, drops the URL', () => {
    expect(toPlainText('voir [le projet](https://x.io/p)')).toBe('voir le projet');
  });

  it('collapses whitespace and newlines to single spaces', () => {
    expect(toPlainText('ligne 1\n\n  ligne 2\t\tfin')).toBe('ligne 1 ligne 2 fin');
  });

  it('returns empty string for empty/undefined input', () => {
    expect(toPlainText('')).toBe('');
    expect(toPlainText(undefined)).toBe('');
    expect(toPlainText(null)).toBe('');
  });

  it('leaves plain text untouched', () => {
    expect(toPlainText('Combien d’œufs aujourd’hui ?')).toBe('Combien d’œufs aujourd’hui ?');
  });
});
