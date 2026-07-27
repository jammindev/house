import { useQueryClient } from '@tanstack/react-query';
import {
  BANKING_ROOT,
  BUDGET_ROOT,
  COMPLIANCE_ROOT,
  EXPENSES_ROOT,
  INTERACTIONS_ROOT,
} from './keys';

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
 */
export function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () => {
    for (const root of [
      BANKING_ROOT,
      INTERACTIONS_ROOT,
      EXPENSES_ROOT,
      BUDGET_ROOT,
      COMPLIANCE_ROOT,
    ]) {
      void queryClient.invalidateQueries({ queryKey: root });
    }
  };
}
