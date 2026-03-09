# Parcours 02 — Compréhension assistée par IA

Cette note complète le parcours 02 sans changer son objectif principal.

Le but n'est pas d'implémenter l'IA maintenant, mais de vérifier que le socle construit pour le traitement manuel des documents reste compatible avec une future couche de compréhension, de qualification et de suggestion de rattachement.

## Résumé

Oui, la direction actuelle est compatible avec une future couche d'IA, à condition de garder le document comme une pièce traçable et révisable, et non comme un objet automatiquement interprété sans visibilité.

Le bon modèle n'est pas :

- l'IA lit un document et décide seule ce qu'il faut faire

Le bon modèle est :

- un document entre dans le système
- le système conserve la pièce source
- une couche de compréhension produit des propositions structurées
- l'utilisateur valide ou corrige le rattachement et les données importantes

## Ce qui colle déjà avec cette vision

Le socle actuel va dans le bon sens.

- Le modèle `Document` existe déjà et centralise le fichier, le type, les notes, l'OCR et les métadonnées.
- Le scoping household existe déjà.
- Le produit est déjà organisé autour de contextes métier explicites : activités, zones, projets.
- Le parcours 01 a déjà consolidé le rôle central des activités dans la mémoire du foyer.

Autrement dit, on peut encore faire évoluer la compréhension sans jeter le socle actuel.

## Principe cible

La couche IA ne doit pas être pensée comme une simple couche cosmétique sur la page documents.

Elle devra pouvoir :

1. lire une pièce ou son texte extrait
2. suggérer ce qu'elle représente
3. proposer un type ou une catégorie utile
4. proposer un contexte probable
5. suggérer un rattachement ou une création d'activité
6. conserver la provenance et le niveau de confiance

Le bon modèle cible est donc :

- `page documents -> qualification manuelle du document`
- `page documents + IA -> qualification assistée du document`
- `email entrant -> document + propositions de compréhension`
- `OCR pipeline -> document + texte extrait`
- `IA -> suggestions structurées, pas décision opaque`

## Conséquence importante pour l'architecture

La page React doit rester un client léger.

Les règles importantes doivent rester côté backend ou dans un contrat métier clair :

- scoping household
- droits d'accès
- conservation de la pièce source
- conservation du texte brut ou extrait
- stratégie de rattachement final
- journalisation de la provenance
- niveau de confiance et mode de validation

Si ces règles restent dans le socle métier, ajouter une future couche d'IA restera une extension naturelle.

## Ce qu'une future IA pourrait aider à faire

Sans changer la vérité métier, une couche d'IA pourrait plus tard :

- suggérer le type du document : facture, devis, manuel, garantie, autre
- extraire des informations utiles : montant, date, fournisseur, référence, garantie
- proposer une activité candidate à lier
- suggérer la création d'une activité si aucun rattachement n'existe
- proposer un projet ou une zone probable si le contexte peut être inféré
- résumer rapidement le document pour l'utilisateur

## Points de vigilance à anticiper

## 1. OCR imparfait et ambiguïté documentaire

Un document peut être mal scanné, mal cadré ou mal reconnu.

Cela implique que le système ne doit jamais dépendre entièrement d'une lecture parfaite du texte pour rendre le document utile.

Le document source doit rester visible et consultable.

## 2. Faux rattachements et hallucinations de contexte

Une IA peut proposer un mauvais projet, une mauvaise activité ou une mauvaise interprétation du rôle du document.

Le mode cible le plus robuste est :

1. confiance haute : suggestion très visible ou pré-remplissage confirmé facilement
2. confiance moyenne : proposition explicite à valider
3. confiance faible : simple aide de lecture ou aucun rattachement automatique

Cela veut dire qu'un vrai mécanisme de validation ou de confirmation restera important.

## 3. Provenance et auditabilité

Une suggestion IA utile doit rester traçable.

Exemples de données qu'il faudra probablement conserver plus tard dans `metadata` ou un objet dédié :

- `source: "email" | "upload" | "photo"`
- `raw_text`
- `ocr_engine`
- `parsed_by`
- `confidence`
- `suggested_type`
- `suggested_links`
- `review_state`

Cette traçabilité est importante pour la confiance, le support utilisateur et l'amélioration future du système.

## 4. Documents sensibles ou bruités

Tous les documents ne doivent pas être interprétés avec la même agressivité.

Exemples :

- document administratif ambigu
- document contenant des données personnelles sensibles
- photo peu lisible
- document composite avec plusieurs sujets

Le design doit permettre de rester utile même sans interprétation automatique forte.

## 5. Canal email entrant

Le produit long terme voudra probablement traiter des documents issus d'emails entrants.

Mais aujourd'hui, l'ingestion email n'est pas encore une surface UI active du runtime.

Il faut donc préserver la compatibilité avec ce futur canal, sans bloquer le parcours 02 sur ce chantier.

## Règles à préserver dès maintenant

Pour éviter de construire puis déconstruire, les décisions suivantes doivent rester vraies :

1. le document source reste la vérité de base
2. l'IA propose, elle ne remplace pas la traçabilité du document
3. les rattachements finaux doivent pouvoir être confirmés ou corrigés
4. la provenance du document et de son interprétation doit pouvoir être conservée
5. les validations importantes ne doivent pas vivre seulement côté React
6. la stratégie doit rester compatible avec des documents arrivant par email, upload manuel ou import pipeline

## Ce qu'il ne faut pas faire

Pour rester compatible avec une compréhension assistée par IA, il faut éviter :

- de masquer le document source derrière un résumé seulement
- de faire dépendre le flux d'un OCR parfait
- de stocker des interprétations IA sans trace de provenance ni confiance
- de coupler la compréhension documentaire à une seule page UI
- de transformer trop tôt des suggestions en vérité métier définitive

## Position produit recommandée

La promesse V1 du parcours 02 peut rester simple :

"Un document utile doit pouvoir être compris et relié au bon contexte sans effort inutile."

Mais la promesse long terme peut être reformulée ainsi :

"Le système doit aider à comprendre et qualifier un document, quel que soit son canal d'entrée, tout en gardant la pièce source et la validation utilisateur au centre."

## Étape suivante recommandée plus tard

Quand le moment viendra de préparer une vraie couche IA pour les documents, le bon sujet ne sera pas d'abord l'UI.

Le bon sujet sera un mini design doc technique sur :

1. les canaux d'entrée supportés
2. le contrat de sortie de compréhension documentaire
3. les niveaux de confiance et les modes de validation
4. la stratégie de rattachement suggéré vers activité, zone, projet ou autre contexte
5. la conservation de la provenance, du texte brut et des métadonnées d'interprétation
