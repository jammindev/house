import { describe, it, expect, vi, beforeEach } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/lib/axios', () => ({ api: { get } }));

import { fetchExpenseSummary } from './expenses';

/**
 * ⚠️ **Un filtre qui n'est pas transmis ne se voit pas.**
 *
 * L'onglet Dépenses composait bien `without_supplier` dans ses filtres et
 * documentait que « le résumé porte le même filtre que la liste » — mais cette
 * fonction ne recopiait pas la clé dans la query string. Les cartes de total
 * comptaient donc toute la période au-dessus d'une liste réduite aux dépenses
 * sans fournisseur, et rien à l'écran ne disait lequel des deux chiffres se
 * trompait. C'est le « compteur qui compte des lignes que la liste ne montre
 * pas » que le module argent passe son temps à réparer, et il avait survécu à la
 * revue parce que l'écran restait parfaitement plausible.
 *
 * D'où ces tests au niveau du **transport** : la clé de cache et l'intention de
 * l'appelant étaient justes tous les deux, seul le passage de relais était
 * cassé.
 */
describe('fetchExpenseSummary — les filtres partent bien au serveur', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { total: '0.00', count: 0 } });
  });

  it('transmet « sans fournisseur »', async () => {
    await fetchExpenseSummary({ from: '2026-07-01', to: '2026-07-31', without_supplier: '1' });

    expect(get).toHaveBeenCalledWith(expect.any(String), {
      params: { from: '2026-07-01', to: '2026-07-31', without_supplier: '1' },
    });
  });

  it('transmet chacun des autres filtres', async () => {
    await fetchExpenseSummary({ supplier: 'Leroy Merlin', kind: 'bank', budget: 'b-1' });

    expect(get).toHaveBeenCalledWith(expect.any(String), {
      params: { supplier: 'Leroy Merlin', kind: 'bank', budget: 'b-1' },
    });
  });

  it("n'envoie pas les clés absentes", async () => {
    // Le serveur lit `?without_supplier=0` comme un **non**, pas comme « absent » :
    // envoyer une valeur vide serait un filtre qui ne filtre pas, à débusquer
    // depuis les logs.
    await fetchExpenseSummary({ from: '2026-07-01' });

    expect(get).toHaveBeenCalledWith(expect.any(String), { params: { from: '2026-07-01' } });
  });
});
