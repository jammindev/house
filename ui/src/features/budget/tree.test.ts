import { describe, it, expect } from 'vitest';
import { selectableBudgets, groupCandidates } from './tree';
import type { Budget } from '@/lib/api/budget';

function budget(partial: Partial<Budget> & { id: string; name: string }): Budget {
  return {
    monthly_amount: null,
    is_global: false,
    parent: null,
    is_group: false,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

const house = budget({ id: 'house', name: 'Maison', is_group: true });
const diy = budget({ id: 'diy', name: 'Bricolage', parent: { id: 'house', name: 'Maison' } });
const energy = budget({ id: 'energy', name: 'Énergie', parent: { id: 'house', name: 'Maison' } });
const gifts = budget({ id: 'gifts', name: 'Cadeaux' });
const overall = budget({ id: 'all', name: 'Global', is_global: true });

const all = [house, diy, energy, gifts, overall];

describe('selectableBudgets', () => {
  it('exclut les groupes et le budget global', () => {
    // ⚠️ C'est la règle qui protège les neuf agrégations : un euro se range sur
    // une feuille. Proposer « Maison » offrirait un choix que le serveur refuse.
    // Triées sur le chemin affiché : « Cadeaux », puis « Maison › … ».
    expect(selectableBudgets(all).map((o) => o.value)).toEqual(['gifts', 'diy', 'energy']);
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

describe('groupCandidates', () => {
  it('ne propose que des budgets racines, jamais le global ni soi-même', () => {
    expect(groupCandidates(all, 'gifts').map((o) => o.value)).toEqual(['house']);
  });

  it("ne propose rien quand le budget est déjà un groupe", () => {
    // Deux niveaux : un groupe ne se range pas dans un groupe. Mêmes règles que
    // le serveur, dans le même ordre.
    expect(groupCandidates(all, 'house')).toEqual([]);
  });

  it('exclut un budget déjà rangé dans un groupe', () => {
    expect(groupCandidates(all, 'gifts').map((o) => o.value)).not.toContain('diy');
  });
});
