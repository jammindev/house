# Parcours 01 — Capture assistée par IA

Cette note complète le parcours 01 sans changer son objectif principal.

Le but n'est pas d'implémenter l'IA maintenant, mais de vérifier que le socle construit pour la capture manuelle reste compatible avec une future capture conversationnelle.

## Résumé

Oui, la direction actuelle est compatible avec une future couche d'IA.

Le formulaire web ne doit pas être vu comme la finalité du parcours, mais comme le premier client d'un contrat métier plus large :

- un événement se produit
- le système le transforme en `Interaction`
- l'utilisateur peut ensuite le retrouver, le relier et l'exploiter

Dans cette logique, WhatsApp, email, chat IA ou formulaire web sont seulement des canaux d'entrée différents vers le même noyau métier.

## Ce qui colle déjà avec cette vision

Le socle actuel va dans le bon sens.

- Le modèle central `Interaction` existe déjà et porte l'objet métier principal.
- L'API de création sait déjà recevoir un payload structuré cohérent.
- Le household scoping est déjà en place.
- `metadata` permet déjà d'absorber des données spécifiques ou temporaires.
- Le parcours 01 est pensé comme un flux de capture d'événement, pas comme une simple page formulaire.

Autrement dit, on n'est pas en train de construire quelque chose qu'il faudra jeter.

## Principe cible

La couche IA ne devra pas "remplir le formulaire".

Elle devra :

1. recevoir un message libre
2. interpréter l'intention métier
3. produire une interaction candidate structurée
4. appeler la même couche de création que le formulaire

Le bon modèle cible est donc :

- `formulaire web -> création d'interaction`
- `dashboard -> création d'interaction`
- `WhatsApp -> création d'interaction`
- `email -> création d'interaction`
- `chat IA -> création d'interaction`

## Conséquence importante pour l'architecture

Le formulaire React doit rester un client léger.

Les règles importantes doivent rester côté backend :

- validation des champs
- scoping household
- contrôles d'accès
- stratégie sur les zones
- mapping vers `metadata`
- traçabilité de la provenance

Si ces règles restent côté backend, ajouter un nouveau canal de capture plus tard sera une extension naturelle.

## Points de vigilance à anticiper

## 1. Zone obligatoire

Aujourd'hui, une interaction doit avoir au moins une zone.

Pour la saisie manuelle, c'est un bon garde-fou.

Pour une saisie IA depuis WhatsApp, cela peut devenir bloquant, car le message libre n'explicite pas toujours la zone.

Trois stratégies possibles plus tard :

1. l'IA infère la zone avec une confiance suffisante
2. le système utilise une zone par défaut du type `À classer`
3. le système crée un brouillon à confirmer

Ce point est le principal sujet de conception à garder en tête.

## 2. Confiance et validation

Il ne faut pas supposer qu'une IA créera toujours une interaction correcte sans revue.

Le mode cible le plus robuste est :

1. confiance haute : création directe
2. confiance moyenne : proposition à confirmer
3. confiance faible : brouillon ou élément à revoir

Cela veut dire qu'à moyen terme, un statut de revue ou de brouillon sera probablement utile.

## 3. Provenance

Une interaction créée par IA devra garder sa source.

Exemples de données à conserver dans `metadata` dans une première phase :

- `source: "whatsapp"`
- `source_message_id`
- `raw_text`
- `confidence`
- `parsed_by`

Cette traçabilité est importante pour l'audit, le support utilisateur et les futures améliorations du système.

## 4. Résolution utilisateur et household

Un canal externe comme WhatsApp exigera une vraie couche d'ingestion pour résoudre :

- quel utilisateur parle
- dans quel household il agit
- si la création est faite en son nom ou via un assistant système

Le modèle multi-tenant actuel est compatible avec ce besoin, mais le canal externe devra respecter ces contraintes.

## Règles à préserver dès maintenant

Pour éviter de construire puis déconstruire, les décisions suivantes doivent rester vraies :

1. le formulaire n'est pas la logique métier
2. toute validation importante vit côté backend
3. le payload d'une interaction reste simple et stable
4. `metadata` absorbe les besoins spécifiques tant qu'ils ne justifient pas un vrai champ métier
5. la provenance de création doit pouvoir être conservée
6. un futur mode `draft` ou `needs_review` ne doit pas être exclu par le design actuel

## Ce qu'il ne faut pas faire

Pour rester compatible avec la capture assistée par IA, il faut éviter :

- de mettre les règles métier seulement dans React
- de coupler la création d'interaction au seul formulaire web
- d'introduire des validations UI impossibles à reproduire côté API
- de durcir trop tôt des champs qui resteront incertains en langage naturel

## Position produit recommandée

La promesse "remplir le formulaire en moins d'une minute" reste bonne pour la V1.

Mais la promesse produit long terme doit être reformulée ainsi :

"Un membre du foyer doit pouvoir capturer un événement avec le moins d'effort possible, quel que soit le canal d'entrée."

Le formulaire rapide est donc une première implémentation crédible de cette promesse, pas une impasse.

## Étape suivante recommandée plus tard

Quand le moment viendra de préparer la couche IA, le bon sujet n'est pas d'abord l'UI.

Le bon sujet sera un mini design doc technique sur :

1. les canaux d'entrée supportés
2. le contrat de payload `Interaction` cible
3. les niveaux de confiance et les modes de validation
4. la stratégie sur les zones manquantes
5. la conservation de la provenance et du texte brut source