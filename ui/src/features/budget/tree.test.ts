import { describe, it, expect } from 'vitest';
import { selectableBudgets, categoryOptions } from './tree';
import type { Budget, BudgetCategory } from '@/lib/api/budget';

function budget(partial: Partial<Budget> & { id: string; name: string }): Budget {
  return {
    monthly_amount: null,
    is_global: false,
    category: null,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

function category(id: string, name: string): BudgetCategory {
  return {
    id,
    name,
    monthly_amount: null,
    budget_count: 0,
    created_at: '',
    updated_at: '',
  };
}

const maison = { id: 'house', name: 'Maison' };
const diy = budget({ id: 'diy', name: 'Bricolage', category: maison });
const energy = budget({ id: 'energy', name: 'Énergie', category: maison });
const gifts = budget({ id: 'gifts', name: 'Cadeaux' });
const overall = budget({ id: 'all', name: 'Global', is_global: true });

const all = [diy, energy, gifts, overall];

describe('selectableBudgets', () => {
  it('garde les budgets rangés dans une catégorie', () => {
    // ⚠️ La régression centrale de l'ancien design : un budget qui recevait des
    // « enfants » cessait d'être une cible de dépense, et il fallait le retirer
    // de six sélecteurs. Ranger une enveloppe ne lui retire plus rien.
    // Triées sur le chemin affiché : « Cadeaux », puis « Maison › … ».
    expect(selectableBudgets(all).map((o) => o.value)).toEqual(['gifts', 'diy', 'energy']);
  });

  it('exclut le seul budget global', () => {
    expect(selectableBudgets(all).map((o) => o.value)).not.toContain('all');
  });

  it('affiche le chemin, parce que le nom seul est ambigu', () => {
    const labels = Object.fromEntries(selectableBudgets(all).map((o) => [o.value, o.label]));
    expect(labels.diy).toBe('Maison › Bricolage');
    expect(labels.gifts).toBe('Cadeaux');
  });

  it('ne casse pas sur une liste absente', () => {
    expect(selectableBudgets(undefined)).toEqual([]);
  });
});

describe('categoryOptions', () => {
  it('propose toutes les catégories, par ordre alphabétique', () => {
    // Aucune n'est jamais indisponible : une catégorie est un intitulé, donc il
    // n'y a pas de refus à expliquer à l'utilisateur.
    const options = categoryOptions([category('b', 'Maison'), category('a', 'Courses')]);
    expect(options.map((o) => o.label)).toEqual(['Courses', 'Maison']);
  });

  it('ne casse pas sur une liste absente', () => {
    expect(categoryOptions(undefined)).toEqual([]);
  });
});
