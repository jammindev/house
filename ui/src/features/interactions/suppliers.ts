import type { SupplierSuggestion } from '@/lib/api/interactions';

/**
 * La clé de comparaison d'un nom de fournisseur — casse et accents neutralisés.
 *
 * Miroir de `interactions.services.normalize_supplier_name`, et pour la même
 * raison : chercher « epi dore » doit trouver « Boulangerie Épi Doré ». Le
 * serveur, lui, s'en sert pour l'unicité — un filtre client plus strict que la
 * contrainte serveur ferait disparaître de la liste un fournisseur que le
 * serveur refuserait pourtant de créer deux fois, et l'utilisateur le retaperait
 * pour rien.
 */
export function normalizeSupplierName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * Les fournisseurs qui correspondent à ce qui est tapé, dans l'ordre d'utilité.
 *
 * L'ordre du serveur (le plus employé d'abord) est **conservé à l'intérieur de
 * chaque groupe** : ce qui commence par la saisie passe devant ce qui la contient
 * seulement. Taper « leroy » ne doit pas mettre « Bricolage Leroy et fils » avant
 * « Leroy Merlin » sous prétexte qu'il est plus ancien.
 *
 * Filtrage côté client et non serveur : un aller-retour par caractère coûterait
 * plus cher que la liste entière, qu'un foyer compte en dizaines.
 */
export function matchSuppliers(
  suppliers: SupplierSuggestion[],
  query: string,
): SupplierSuggestion[] {
  const needle = normalizeSupplierName(query);
  if (!needle) return suppliers;

  const startsWith: SupplierSuggestion[] = [];
  const contains: SupplierSuggestion[] = [];
  for (const row of suppliers) {
    const name = normalizeSupplierName(row.name);
    if (name.startsWith(needle)) startsWith.push(row);
    else if (name.includes(needle)) contains.push(row);
  }
  return [...startsWith, ...contains];
}
