# Fiches explicatives

Ce dossier contient des fiches concises sur les concepts techniques importants utilisés dans `house`. Objectifs :

- **Apprentissage** : monter en compétence sur les concepts qu'on intègre (RAG, embeddings, full-text, etc.)
- **Onboarding** : permettre à un futur contributeur (ou à toi-même dans 6 mois) de comprendre rapidement *pourquoi* un choix a été fait
- **Décisions ancrées** : chaque fiche cite les décisions prises, ce qu'on a écarté, et pourquoi

## Format d'une fiche

Chaque fiche suit le même squelette :

1. **Le problème** — qu'est-ce qu'on cherche à résoudre ?
2. **Le concept en deux phrases** — la version courte
3. **Comment on l'a appliqué dans house** — l'instance concrète
4. **Pourquoi cette implémentation** — décisions et trade-offs
5. **Ce qu'on a écarté et pourquoi** — alternatives évaluées
6. **Pour aller plus loin** — liens externes pour creuser

## Index

- [RAG.md](RAG.md) — Retrieval-Augmented Generation : comment l'agent conversationnel répond à partir de la mémoire du foyer (parcours 07)
- [EMBEDDINGS.md](EMBEDDINGS.md) — Embeddings & recherche sémantique hybride : ajouter une jambe vectorielle (pgvector + fusion RRF) au retrieval full-text (parcours 21)
- [PWA_PUSH.md](PWA_PUSH.md) — PWA & Web Push : app installable + notifications système sans app native (VAPID, service worker, django-vite) (parcours app mobile)
- [CARTOGRAPHIE_DEPENSES.md](CARTOGRAPHIE_DEPENSES.md) — Cartographie du mécanisme de dépenses : tous les points d'écriture et de lecture, et la dette résorbée (parcours 08 + 21)
- [IMPORT_ET_RAPPROCHEMENT.md](IMPORT_ET_RAPPROCHEMENT.md) — Import idempotent & rapprochement flou : dédupliquer un relevé bancaire sans identifiant natif, et apparier une ligne à un achat déjà saisi (parcours 25)
- [SNAPSHOT_ET_RECIT.md](SNAPSHOT_ET_RECIT.md) — Instantané figé & récit tardif : garder la mémoire d'une période close sans réécrire l'histoire, et la raconter dans la langue du lecteur (parcours 21 + 27)
- [PIPELINE_MEDIA.md](PIPELINE_MEDIA.md) — Pipeline média : où vivent les octets, qui les sert, quand ils sont transformés (stockage objet optionnel, URL présignée et contrôle d'accès, file de tâches adossée à Postgres) (parcours 29)
- [AUTO_HEBERGEMENT.md](AUTO_HEBERGEMENT.md) — D'un déploiement à un produit installable : ce que change le passage à l'auto-hébergement (modèle de menace, capacités optionnelles, licence copyleft réseau, sauvegarde comme fonctionnalité) (parcours 28)

## Quand créer une fiche ?

À chaque fois qu'on intègre un concept non-trivial qui :
- demande de lire de la doc externe pour le comprendre
- influence l'architecture (ex: registry pattern, RAG, OCR pipeline, observabilité)
- a fait l'objet d'un choix entre plusieurs options viables

Pas besoin de fiche pour les patterns évidents ou triviaux (CRUD, formulaire, etc.).
