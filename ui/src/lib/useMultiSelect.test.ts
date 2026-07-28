import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMultiSelect } from './useMultiSelect';

/**
 * Ce que ce hook tient, et pourquoi c'est du métier :
 *
 * 1. **La sélection ne dépasse jamais ce qui est à l'écran.** Elle est *dérivée*
 *    des ids disponibles à chaque lecture, pas recopiée puis nettoyée par un effet.
 *    Une action de masse sur un élément que l'utilisateur ne voit plus (supprimé,
 *    sorti du filtre) est un dégât qu'aucun écran n'explique.
 * 2. **Changer de portée vide la sélection.** Cocher douze photos « sans zone »,
 *    puis basculer sur « Salon », ne doit pas laisser douze cases cochées
 *    invisibles — le lot suivant s'appliquerait à autre chose que ce qu'on croit.
 * 3. **L'ordre suit celui de l'écran** : le lot part dans l'ordre affiché, pas dans
 *    celui des clics, pour qu'un message « 3 sélectionnées » soit vérifiable à l'œil.
 */
describe('useMultiSelect', () => {
  it('démarre hors mode sélection, sans rien de coché', () => {
    const { result } = renderHook(() => useMultiSelect(['a', 'b', 'c']));

    expect(result.current.active).toBe(false);
    expect(result.current.count).toBe(0);
    expect(result.current.selectedIds).toEqual([]);
  });

  it('entre et sort du mode sélection', () => {
    const { result } = renderHook(() => useMultiSelect(['a', 'b']));

    act(() => result.current.enter());
    expect(result.current.active).toBe(true);

    act(() => result.current.exit());
    expect(result.current.active).toBe(false);
  });

  it('vide la sélection en sortant du mode', () => {
    const { result } = renderHook(() => useMultiSelect(['a', 'b']));

    act(() => result.current.enter());
    act(() => result.current.toggle('a'));
    act(() => result.current.exit());

    expect(result.current.count).toBe(0);
  });

  it('coche et décoche', () => {
    const { result } = renderHook(() => useMultiSelect(['a', 'b']));

    act(() => result.current.toggle('a'));
    expect(result.current.isSelected('a')).toBe(true);
    expect(result.current.count).toBe(1);

    act(() => result.current.toggle('a'));
    expect(result.current.isSelected('a')).toBe(false);
  });

  it('rend la sélection dans l’ordre affiché, pas dans celui des clics', () => {
    const { result } = renderHook(() => useMultiSelect(['a', 'b', 'c']));

    act(() => result.current.toggle('c'));
    act(() => result.current.toggle('a'));

    expect(result.current.selectedIds).toEqual(['a', 'c']);
  });

  it('sélectionne tout, puis efface', () => {
    const { result } = renderHook(() => useMultiSelect(['a', 'b', 'c']));

    act(() => result.current.selectAll());
    expect(result.current.allSelected).toBe(true);
    expect(result.current.selectedIds).toEqual(['a', 'b', 'c']);

    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
    expect(result.current.allSelected).toBe(false);
  });

  it('ne se dit pas « tout sélectionné » sur une liste vide', () => {
    const { result } = renderHook(() => useMultiSelect([] as string[]));

    // Sinon le bouton bascule proposerait « Effacer » alors qu'il n'y a rien.
    expect(result.current.allSelected).toBe(false);
  });

  it('oublie un élément qui disparaît de l’écran', () => {
    const { result, rerender } = renderHook(({ ids }) => useMultiSelect(ids), {
      initialProps: { ids: ['a', 'b', 'c'] },
    });

    act(() => result.current.toggle('b'));
    rerender({ ids: ['a', 'c'] });

    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.count).toBe(0);
  });

  it('garde la sélection quand la liste bouge autour', () => {
    const { result, rerender } = renderHook(({ ids }) => useMultiSelect(ids), {
      initialProps: { ids: ['a', 'b'] },
    });

    act(() => result.current.toggle('a'));
    rerender({ ids: ['a', 'b', 'c'] });

    expect(result.current.selectedIds).toEqual(['a']);
  });

  it('vide la sélection quand la portée change', () => {
    const { result, rerender } = renderHook(
      ({ ids, scope }) => useMultiSelect(ids, { scopeKey: scope }),
      { initialProps: { ids: ['a', 'b'], scope: 'sans-zone' } },
    );

    act(() => result.current.enter());
    act(() => result.current.toggle('a'));
    rerender({ ids: ['a', 'b'], scope: 'salon' });

    expect(result.current.count).toBe(0);
    // Le mode, lui, ne se referme pas : l'utilisateur est encore en train de trier.
    expect(result.current.active).toBe(true);
  });
});
