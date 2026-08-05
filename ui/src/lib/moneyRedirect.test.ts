import { describe, expect, it } from 'vitest';
import { resolveMoneyRedirect } from './moneyRedirect';

/**
 * Le module Argent a cessé d'être une page à onglets (issue #562), et cinq
 * `?tab=` continuent d'arriver : favoris, `url_template` d'agent d'avant la
 * bascule, liens partagés. Ce qui se teste ici n'est pas la redirection — c'est
 * qu'elle **ne perd rien** : un lien qui survit en montrant autre chose est pire
 * qu'un lien mort, parce que personne ne va vérifier.
 */
describe('resolveMoneyRedirect', () => {
  it('sends each legacy tab to the page that now holds it', () => {
    expect(resolveMoneyRedirect('?tab=budgets')).toBe('/app/money/budgets');
    expect(resolveMoneyRedirect('?tab=expenses')).toBe('/app/money/expenses');
    expect(resolveMoneyRedirect('?tab=accounts')).toBe('/app/money/accounts?tab=accounts');
  });

  it('keeps control and pending as tabs of the accounts page', () => {
    expect(resolveMoneyRedirect('?tab=control')).toBe('/app/money/accounts?tab=control');
    expect(resolveMoneyRedirect('?tab=pending')).toBe('/app/money/accounts?tab=pending');
  });

  it('preserves the other parameters — `?b={id}` opened *one* budget', () => {
    expect(resolveMoneyRedirect('?tab=budgets&b=42')).toBe('/app/money/budgets?b=42');
    expect(resolveMoneyRedirect('?b=42', 'budgets')).toBe('/app/money/budgets?b=42');
  });

  it('drops `tab` on a page that no longer has tabs', () => {
    // Un paramètre qui ne pilote plus rien se recopie dans un favori et fait
    // croire à une intention que la page n'honore pas.
    expect(resolveMoneyRedirect('?tab=expenses&supplier=Leclerc')).toBe(
      '/app/money/expenses?supplier=Leclerc',
    );
  });

  it('lets an explicit tab win over the page being replaced', () => {
    // `/app/budget?tab=accounts` : l'appelant a été plus précis que l'URL.
    expect(resolveMoneyRedirect('?tab=accounts', 'budgets')).toBe(
      '/app/money/accounts?tab=accounts',
    );
  });

  it('falls back to the replaced page when no tab is given', () => {
    expect(resolveMoneyRedirect('', 'expenses')).toBe('/app/money/expenses');
    expect(resolveMoneyRedirect('', 'accounts')).toBe('/app/money/accounts?tab=accounts');
  });

  it('falls back to the first page of the group when nothing says otherwise', () => {
    expect(resolveMoneyRedirect('')).toBe('/app/money/budgets');
    expect(resolveMoneyRedirect('?tab=')).toBe('/app/money/budgets');
    expect(resolveMoneyRedirect('?tab=nonsense')).toBe('/app/money/budgets');
  });

  it('carries the hash', () => {
    expect(resolveMoneyRedirect('?tab=budgets', 'budgets', '#top')).toBe(
      '/app/money/budgets#top',
    );
  });
});
