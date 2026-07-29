import { describe, expect, it } from 'vitest';
import { matchSuppliers, normalizeSupplierName } from './suppliers';
import type { SupplierSuggestion } from '@/lib/api/interactions';

const supplier = (name: string, count = 0): SupplierSuggestion => ({ name, count });

describe('normalizeSupplierName', () => {
  it("ignore la casse, les accents et les espaces en trop", () => {
    // Miroir de `interactions.services.normalize_supplier_name`. Un filtre client
    // plus strict que la contrainte serveur ferait disparaître de la liste un
    // fournisseur que le serveur refuse pourtant de créer deux fois — et il
    // serait retapé pour rien.
    expect(normalizeSupplierName('Boulangerie  Épi Doré')).toBe('boulangerie epi dore');
    expect(normalizeSupplierName('LEROY MERLIN')).toBe(normalizeSupplierName('leroy merlin'));
  });
});

describe('matchSuppliers', () => {
  it("rend la liste entière quand rien n'est tapé", () => {
    const rows = [supplier('Leroy Merlin', 12), supplier('Decathlon', 3)];
    expect(matchSuppliers(rows, '')).toEqual(rows);
    expect(matchSuppliers(rows, '   ')).toEqual(rows);
  });

  it('trouve malgré les accents et la casse', () => {
    const rows = [supplier('Boulangerie Épi Doré')];
    expect(matchSuppliers(rows, 'epi dore')).toHaveLength(1);
  });

  it('met ce qui commence par la saisie avant ce qui la contient', () => {
    // Taper « leroy » ne doit pas remonter « Bricolage Leroy et fils » avant
    // « Leroy Merlin » sous prétexte qu'il est plus ancien dans la liste.
    const rows = [supplier('Bricolage Leroy et fils', 9), supplier('Leroy Merlin', 2)];
    expect(matchSuppliers(rows, 'leroy').map((row) => row.name)).toEqual([
      'Leroy Merlin',
      'Bricolage Leroy et fils',
    ]);
  });

  it("conserve l'ordre d'usage du serveur à l'intérieur d'un groupe", () => {
    const rows = [supplier('Carrefour Market', 20), supplier('Carrefour City', 4)];
    expect(matchSuppliers(rows, 'carrefour').map((row) => row.name)).toEqual([
      'Carrefour Market',
      'Carrefour City',
    ]);
  });

  it('ne renvoie rien sur un nom inconnu — la saisie libre prend le relais', () => {
    expect(matchSuppliers([supplier('Decathlon')], 'plombier')).toEqual([]);
  });
});
