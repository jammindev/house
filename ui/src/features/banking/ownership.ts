/**
 * Ce que l'éditeur de ventilation **possède** — miroir de
 * `apps/interactions/kinds.py::OWNED_BY_ALLOCATION_EDITOR`.
 *
 * Une dépense `kind='bank'` n'existe que parce qu'on a ventilé une ligne : elle
 * est *la ventilation*, pas un fait rapproché après coup. La détacher ne libère
 * rien — elle fabrique deux écarts d'un seul geste (une dépense que plus rien ne
 * justifie, et une sortie redevenue partiellement ventilée) pour le même argent.
 * Ce qu'on veut dans ce cas, c'est modifier ou supprimer la ventilation, depuis
 * l'opération.
 *
 * Tout le reste (un achat de projet, une occurrence de récurrence, une dépense
 * saisie à la main) a été rapproché délibérément : détacher est alors le geste
 * inverse exact du rattachement, et il doit exister des deux côtés.
 */
const OWNED_KINDS = new Set(['bank']);

export function isOwnedByAllocationEditor(kind: string | null | undefined): boolean {
  return OWNED_KINDS.has(kind ?? '');
}
