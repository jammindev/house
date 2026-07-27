/**
 * Palette des séries de graphique — tirée des tokens, jamais de couleurs en dur.
 *
 * Le design-system expose cinq `--chart-*` ; au-delà on repart au début plutôt
 * que d'inventer des teintes. Deux catégories de même couleur dans une légende
 * de douze, c'est un désagrément ; une couleur hors thème qui reste bleu vif en
 * mode sombre, c'est un bug visuel — et la règle « pas de hardcode » du
 * CLAUDE.md existe exactement pour ça.
 *
 * L'index doit être **stable pour une même série** d'un rendu à l'autre : on
 * l'indexe sur la position dans une liste triée côté serveur, pas sur l'ordre
 * d'arrivée d'un `map` filtré.
 */
const CHART_TOKENS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const;

/** Couleur de la série n° `index`. */
export function chartColor(index: number): string {
  return CHART_TOKENS[index % CHART_TOKENS.length];
}

/**
 * Couleur du seau « hors budget » — volontairement hors palette.
 *
 * Ce n'est pas une catégorie de plus : c'est ce qui n'a pas été classé. Lui
 * donner une teinte de la palette le ferait lire comme une enveloppe légitime,
 * alors que la barre grise dit « il reste du travail ici ».
 */
export const UNBUDGETED_COLOR = 'hsl(var(--muted-foreground))';
