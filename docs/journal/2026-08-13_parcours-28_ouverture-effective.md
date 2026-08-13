# L'ouverture — ce qui restait vraiment, et ce qui n'était vrai que sur le papier

**2026-08-13** · parcours 28 · issues #492, #494

La session devait faire un état des lieux avant d'ouvrir au public. Elle a trouvé
une porte déjà ouverte, une porte fermée qu'on croyait ouverte, et deux textes qui
se contredisaient — dont un que personne n'aurait relu.

## L'inscription était ouverte, sur un dépôt public depuis dix mois

`POST /api/accounts/users/` était en `AllowAny`. Ce n'était pas un risque futur à
planifier : c'était un trou en production, sur un dépôt public depuis le
2025-09-21. Trois défauts empilés, tous silencieux :

1. **Aucune validation de mot de passe à l'inscription.** `set_password` hache
   n'importe quoi ; `AUTH_PASSWORD_VALIDATORS` n'était consulté nulle part sur ce
   chemin, et `abc` passait. L'app était donc **plus stricte sur un changement de
   mot de passe que sur le premier** — l'inverse de ce qu'il faut.
2. **Aucun plafond de débit** sur quoi que ce soit.
3. Et surtout : **le cache était `LocMemCache`.**

Le troisième est le seul intéressant. DRF compte ses throttles dans
`django.core.cache` ; avec un cache par process et quatre workers gunicorn, « 5
tentatives par minute » en autorise vingt, et tout repart à zéro à chaque deploy.
Livrer les throttles sans changer le cache aurait produit **un compteur qui ment
d'un facteur quatre** — c'est-à-dire la pire des trois situations, parce qu'elle a
l'air réglée. D'où `DatabaseCache` et sa table créée par migration (`core.0003`),
pas par une commande à lancer : sans elle l'API tombe à la première requête.

Le test de couverture des tarifs a lui-même dû être réécrit : il lisait
`cls.throttle_classes` et ne voyait donc **rien** de ce qu'un `get_throttles()`
par action installe. Il passait sous sabotage. Il balaye maintenant les
sous-classes de `SimpleRateThrottle` du projet.

## La sauvegarde faisait 369 octets

Elle existait, elle était planifiée, elle n'avait jamais été restaurée. En la
restaurant sur une base jetable — 93 tables, 5 utilisateurs, 213 documents,
l'extension `vector` — on a découvert que la seule archive présente était **vide**.

C'est la règle du § 3.4 de la fiche auto-hébergement retournée contre son auteur :
*une sauvegarde jamais restaurée n'est pas une sauvegarde.* Elle valait pour les
instances tierces ; elle valait aussi ici.

## Le logo était sur un écran que personne ne voit

Le lot 8 avait posé la marque sur `templates/login.html`. Ces gabarits Django sont
**morts** : l'authentification passe par la SPA React. Personne ne l'a vu en
relecture, parce qu'un diff qui ajoute un logo à un gabarit de connexion ressemble
exactement à un diff qui ajoute un logo à l'écran de connexion.

Ça s'est vu en **regardant la page servie**. Même méthode qui a attrapé, le même
jour : un `logo-mark.svg` que j'avais rendu invalide en écrivant `--primary` dans
un commentaire XML (le fichier se chargeait en silence, `onerror` ne recevant
qu'un `Event` sans message), un premier dessin qui **se lisait comme un cadenas**
à 16 px, et une modale de consentement qui recouvrait la page de l'assistant et
interceptait tous les clics du harnais de captures — trois sélecteurs ont échoué
avant qu'on la voie, chacun avec un message qui n'en parlait pas.

## La façade vendait le mauvais produit

Le premier README ouvrait sur le tableau de bord et les budgets, et rangeait l'IA
dans un paragraphe. Il racontait donc un YNAB auto-hébergé — un produit qui a déjà
dix concurrents meilleurs. Ce que Maisonnée a d'unique n'est pas le budget : c'est
qu'un assistant puisse **répondre sur le foyer**, et il ne le peut que parce que
les chantiers, le journal, les documents et les compteurs sont dans le même
registre.

Recadré (PR #574) : l'assistant en image d'ouverture, citant ses sources ; le
journal juste après comme « la mémoire dans laquelle il puise » ; l'argent
redevenu un module. Et la capture de l'assistant relit une conversation **semée**,
sans aucun appel au fournisseur — donc reproductible, gratuite et identique à
chaque exécution.

## Et l'aperçu social est resté sur la version d'avant

Trois heures plus tard, `social-preview.png` disait encore « the money, the works »
et s'arrêtait à « everything a household keeps alive ». C'est l'image que voit en
premier quelqu'un à qui on partage le lien — avant le README, qu'il n'ouvrira
peut-être jamais.

Deux exemplaires d'un même texte divergent toujours. La réponse est celle du
projet partout ailleurs : un harnais dans le dépôt (`npm run brand:social`), et un
test qui compare la **source du harnais** au README. Pas le PNG — un pixel ne dit
pas ce qu'il raconte.

## L'image n'était tirable par personne

Le plus coûteux, et le plus invisible. `v0.1.0` avait été publiée le 4 août avec
succès : build vert, deux architectures, smoke test passé, notes de release
écrites. Le paquet `ghcr.io` était **privé**, et un inconnu qui suivait les trois
lignes du README recevait `denied` — pendant neuf jours.

Deux portes, aucune ouverte par défaut, aucune visible depuis le code :

1. un paquet `ghcr.io` neuf est privé, **même poussé depuis un dépôt public** ;
2. une politique d'organisation peut interdire les paquets publics, et grise alors
   le bouton sous un message qui ne nomme ni le réglage, ni la page, ni le fait
   qu'on en est soi-même l'administrateur.

D'où la règle, écrite dans sa propre fiche
([DISTRIBUTION_ET_REGISTRE.md](../fiches/DISTRIBUTION_ET_REGISTRE.md)) : **une
promesse dont la vérité vit hors du dépôt se vérifie de dehors, dans la position
du lecteur.** Pas en relisant le workflow qui pousse l'image, pas en regardant la
coche verte de la release — en tirant l'image sans être authentifié.

## Ce que la session laisse

Livré et déployé : durcissement du débit et de l'inscription (#569), plafonds
mémoire des conteneurs (#570), identité visuelle (#571, #573), façade bilingue et
captures (#572, #574), aperçu social (#581). Côté serveur : 15 Go de cache de
build purgés, inscription fermée sur l'instance de l'auteur, sauvegarde
quotidienne par timer systemd utilisateur — **et restaurée pour de vrai**.

Le parcours 28 n'a plus qu'un lot ouvert : le 7, la recette pilote. Il ne dépend
plus de rien de technique.

**Ce qui reste faux, et qui est écrit ici pour ne pas être oublié** : il n'existe
aucun plafond de dépense sur l'API du fournisseur. `AIUsageLog` observe, il ne
coupe pas. C'est sans conséquence tant que l'auteur n'héberge pas de foyers tiers,
et ça devient bloquant le jour où il le ferait.
