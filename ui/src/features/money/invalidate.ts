import { useInvalidate } from '@/lib/invalidate';

/**
 * Ce qu'une écriture sur l'argent rend périmé — **déclaré une fois**.
 *
 * L'argent est une seule donnée lue par cinq caches : le journal bancaire, le
 * journal des interactions, le résumé des dépenses, les compteurs de budget et
 * la conformité. Une ligne ventilée les touche tous les cinq ; un relevé importé
 * aussi ; classer une recette change un écart.
 *
 * Chaque hook listait pourtant sa propre combinaison, et elles avaient dérivé —
 * cinq mutations sur huit oubliaient au moins une famille :
 *
 * - **importer un relevé** n'invalidait que `banking`, alors que c'est le moment
 *   où les compteurs passent de zéro à cent ;
 * - **rapprocher** oubliait les dépenses, que la passe crée pourtant en
 *   confirmant des récurrences ;
 * - **rattacher une dépense**, **classer une recette**, **refléter un retrait**
 *   n'invalidaient pas la conformité : l'écart disparaissait de l'écran et
 *   restait dans le badge.
 *
 * Un compteur qui contredit la liste juste en dessous fait perdre leur crédit
 * aux deux. La règle est donc devenue une seule fonction : **toute mutation qui
 * touche à l'argent invalide tout l'argent.** Invalider trop large coûte
 * quelques requêtes sur des vues déjà montées ; invalider trop étroit coûte la
 * confiance dans les chiffres, et le bug est invisible en revue.
 *
 * ⚠️ Les cinq racines ne sont plus énumérées ici : elles sont **déclarées dans
 * le graphe** de `lib/invalidate`, généralisation de cette règle au reste de
 * l'app (le même oubli existait sur le dashboard, les alertes et le coût d'un
 * projet). Passer par le graphe apporte en prime ce que l'argent périmait sans
 * le dire : **le coût réel d'un projet** est une somme de dépenses, et
 * l'activité du dashboard en est le fil.
 */
export function useInvalidateMoney() {
  const invalidate = useInvalidate();
  return () => invalidate('interactions');
}
