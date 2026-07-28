# 2026-07-28 — Parcours 27 cadrage initial

## Contexte

Session de cadrage du vingt-septième chantier de House : le **récap mensuel
raconté** du foyer.

Déclencheur — la demande de l'utilisateur : « mon app devient énorme, je voudrais la
rendre plus fun et que l'utilisateur ait envie de l'utiliser, comme ce que peuvent
procurer les réseaux sociaux ». La séance a commencé par un **classement de leviers
d'engagement**, pas par une feature : House a trente-trois modules, aucune primitive
de gamification, et un problème affectif clair — **l'application est entièrement
tournée vers le devoir.** Chaque module demande quelque chose ; aucun ne raconte jamais
ce que ça donne.

Sept leviers ont été classés par retour décroissant. Le n°1 (fil du foyer avec
réactions) et le n°2 (récap raconté) sont ressortis loin devant, pour la même raison :
ils exploitent de la donnée déjà présente et n'ajoutent **aucun devoir** à
l'utilisateur. L'utilisateur a retenu le n°2 pour ce chantier.

Le but explicite de la session : **produire uniquement de la documentation, des specs
et les issues GitHub** — pas de code.

## Ce qui a été confirmé (décisions)

- **Le socle existait déjà, et c'était la découverte de la séance.** Le bilan
  budgétaire du parcours 21 (`apps/budget/report/`) fait exactement ce qu'on voulait
  construire — instantané chiffré figé à la clôture du mois, prose rendue plus tard
  dans la langue du lecteur, vernis LLM optionnel mémoïsé, rendez-vous par `PingSpec` —
  mais sur l'argent seul, servi par une page qui affiche un paragraphe gris. Le
  chantier n'est donc pas « construire un bilan » mais **élargir un bilan d'argent en
  récit de foyer**. Presque tout le travail est de la composition.

- **Une nouvelle app `apps/recap/`, pas une extension de `budget`.** L'argent est un
  chapitre parmi quatre. Le récap consomme sept modules et n'appartient à aucun.

- **Le contrat de collecteur diffère de celui du digest** — et c'est le piège n°1 du
  chantier. Un collecteur de digest renvoie des chaînes **déjà traduites** ; correct
  pour un message jetable composé pour un destinataire connu. Un récap est persistant
  et relu : ses collecteurs renvoient des **données**, la langue arrive au rendu.
  Copier un collecteur de digest tel quel gèlerait la langue de l'auteur dans
  l'historique.

- **Un instantané de foyer exclut le privé au calcul, pas à l'affichage** — corollaire
  du point précédent, et piège n°2. Le digest filtre les tâches privées selon son
  destinataire ; un instantané est gelé une fois et lu par tous les membres.

- **Aucun chiffre ventilé par membre, jamais.** Ni classement, ni score, ni badge.
  Décision produit assumée et tenue par un test
  (`test_the_recap_never_breaks_down_by_member`) : chiffrer que l'un en a fait moins
  que l'autre transformerait un moment de fierté en dispute, et la personne qui perd
  désinstalle. Un chiffre de contribution ne se dit qu'au collectif.

- **Le chapitre Argent lit le `BudgetReport` gelé, il ne resomme rien.** Application
  directe de la règle transverse « un compteur ne peut pas avoir deux définitions » :
  un `Sum("amount")` dans `apps/recap/` serait un bug de conception.

- **Un instantané gelé est un format public** : on ajoute des clés, on n'en renomme
  jamais. Un chapitre livré plus tard n'apparaît pas dans les mois déjà gelés, et le
  rendu doit tolérer un `kind` inconnu — pour toujours.

- **Un récap pauvre ne part pas** (`RECAP_MIN_CARDS`, défaut 3) : l'instantané est
  quand même calculé et consultable, mais ni ping ni carte dashboard. Un rendez-vous
  qui livre du vide use le rendez-vous.

- **Le ping est un teaser + lien, pas le récap.** Une story se regarde, elle ne se lit
  pas dans un fil Telegram. Conséquence assumée : doublon possible avec le bilan
  budgétaire du 1er, donc `monthly_recap` est **off par défaut**.

## Périmètre V1 arbitré

Story séquencée (cartes plein écran, une idée par écran) · **mensuel seul** ·
quatre chapitres (argent, ce qu'on a accompli, la maison, souvenirs) ·
**aucun partage hors du foyer**.

Différé explicitement : bilan annuel (obligerait chaque chapitre à savoir agréger sur
douze mois sans aucun recul d'usage sur un), export image et lien public (le récap
contient montants, noms de pièces, photos de l'intérieur — cadrage sécurité à part, et
on ne sait pas encore quelles cartes valent d'être montrées), réactions et commentaires
(c'est le levier n°1, il mérite son parcours), récap hebdomadaire (une semaine de foyer
contient rarement une histoire), rattrapage historique (les premiers mois d'un foyer
sont incomplets et produiraient des récaps faux).

## Livrables de la séance

- Doc produit : [`PARCOURS_27_LE_RECAP_MENSUEL_RACONTE.md`](../parcours/PARCOURS_27_LE_RECAP_MENSUEL_RACONTE.md)
- Backlog technique en 6 lots : [`PARCOURS_27_BACKLOG_TECHNIQUE.md`](../parcours/PARCOURS_27_BACKLOG_TECHNIQUE.md)
- Fiche concept : [`SNAPSHOT_ET_RECIT.md`](../fiches/SNAPSHOT_ET_RECIT.md) — instantané
  figé & récit tardif, le concept que le parcours 21 avait posé sans le nommer
- Issues GitHub : #435 (ombrelle), #436 → #441 (les six lots)
- Renvois croisés ajoutés dans `MODULES/budget.md` et `MODULES/digest.md`

## Ordre d'implémentation retenu

Tranche verticale d'abord — **1 → 2 → 3 → 4** : à la fin du lot 4, la story tourne pour
de vrai avec un seul chapitre, et c'est là qu'on juge la forme, à peu de frais.
**Puis 5** (l'élargissement, sans risque de conception), **puis 6** (le rendez-vous,
qui n'a de sens qu'une fois qu'il y a quelque chose à annoncer).

Ne pas inverser 4 et 5 : quatre chapitres écrits contre une mise en scène pas encore
validée sont quatre chapitres à réécrire.

## Questions restées ouvertes

- **Combien d'utilisateurs actifs par foyer, en vrai ?** Si l'usage est majoritairement
  solo, le récap est le bon premier levier et le fil du foyer devient secondaire. Si le
  foyer est réellement à deux ou plus, le fil passe devant après cette V1.
- **Usage familial avec enfants ?** C'est le seul cas où les points et badges écartés
  ici remontent vraiment — sur des enfants, ils fonctionnent.
