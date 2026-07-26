import type { ComplianceGroup, ComplianceSummary } from '@/lib/api/banking';

/**
 * Un contrôle bloqué ne doit **jamais** se lire « conforme ».
 *
 * C'est le bug qui a shippé au parcours 26 : un compte dont la date de solde
 * d'ouverture était postérieure à son relevé n'avait aucune fenêtre de conformité,
 * donc tous les détecteurs voyaient zéro ligne — et l'app affichait une coche verte
 * avec « Toutes vos opérations sont affectées ». Silence produit par le mécanisme
 * même qui existe pour empêcher le silence.
 *
 * Un compteur à zéro a donc deux sens qu'il faut distinguer partout :
 * **rien à signaler** et **rien d'évaluable**.
 */

/** Le groupe prérequis d'un contrôle, s'il est encore ouvert. */
export function blockingPrerequisite(
  groups: ComplianceGroup[],
  group: ComplianceGroup,
): ComplianceGroup | null {
  if (!group.blocked_by) return null;
  const prerequisite = groups.find((candidate) => candidate.kind === group.blocked_by);
  return prerequisite && prerequisite.open > 0 ? prerequisite : null;
}

/**
 * Le prérequis bloquant du foyer, tous contrôles confondus — ce que la file « À
 * ranger » doit annoncer au lieu d'une coche verte.
 */
export function householdBlocker(summary: ComplianceSummary | undefined): ComplianceGroup | null {
  if (!summary) return null;
  return summary.groups.find((group) => group.severity === 'blocker' && group.open > 0) ?? null;
}
