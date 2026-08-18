/**
 * Ce que le module de santé doit garantir, et qu'aucune relecture n'attrape.
 *
 * Le défaut n'est pas hypothétique : la liste a affiché
 * `equipment.category.hvac` **en toutes lettres** à l'écran, parce qu'une base
 * semée par du code antérieur à la migration 0006 portait encore `hvac`. Une
 * clé i18n construite ne se vérifie pas statiquement (cf. `keys.test.ts`) ; la
 * seule protection est de ne jamais construire la clé à partir de ce que la
 * base contient.
 */
import { describe, expect, it } from 'vitest';

import { EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS } from '@/lib/api/equipment';
import fr from '@/locales/fr/translation.json';
import { categoryKey, conditionKey, isNoteworthy } from './health';

describe('categoryKey', () => {
  it('laisse passer une valeur du vocabulaire', () => {
    expect(categoryKey('garden')).toBe('garden');
  });

  it("range l'inconnu dans « autre » plutôt que d'afficher du jargon", () => {
    // `hvac` : la valeur réellement rencontrée en base.
    expect(categoryKey('hvac')).toBe('other');
    expect(categoryKey('un truc jamais vu')).toBe('other');
    expect(categoryKey('')).toBe('other');
    expect(categoryKey(null)).toBe('other');
    expect(categoryKey(undefined)).toBe('other');
  });
});

describe('conditionKey', () => {
  it('retombe sur « bon état » pour une valeur hors vocabulaire', () => {
    expect(conditionKey('good')).toBe('good');
    expect(conditionKey('Neuf')).toBe('good');
    expect(conditionKey(null)).toBe('good');
  });
});

describe('le catalogue couvre le vocabulaire', () => {
  /**
   * Le pendant de la règle des énumérations : ce qui n'est pas vérifiable
   * statiquement côté clé construite se vérifie ici, côté valeurs.
   */
  it('a un libellé pour chaque catégorie', () => {
    for (const key of EQUIPMENT_CATEGORIES) {
      expect(fr.equipment.category, `catégorie ${key}`).toHaveProperty(key);
    }
  });

  it('a un libellé pour chaque état', () => {
    for (const key of EQUIPMENT_CONDITIONS) {
      expect(fr.equipment.condition, `état ${key}`).toHaveProperty(key);
    }
  });

  it('a une phrase pour chaque verdict de santé', () => {
    for (const state of ['unknown', 'expired', 'expiring', 'valid']) {
      expect(fr.equipment.health.warranty).toHaveProperty(state);
    }
    for (const state of ['unknown', 'overdue', 'due_soon', 'ok']) {
      expect(fr.equipment.health.maintenance).toHaveProperty(state);
    }
  });
});

describe('isNoteworthy', () => {
  it("ne retient que ce qui réclame un geste", () => {
    expect(isNoteworthy('overdue')).toBe(true);
    expect(isNoteworthy('due_soon')).toBe(true);
    expect(isNoteworthy('expired')).toBe(true);
    expect(isNoteworthy('expiring')).toBe(true);
  });

  it('tait ce qui va bien — une carte qui répète « rien à signaler » cesse d’être lue', () => {
    expect(isNoteworthy('ok')).toBe(false);
    expect(isNoteworthy('valid')).toBe(false);
    expect(isNoteworthy('unknown')).toBe(false);
  });
});
