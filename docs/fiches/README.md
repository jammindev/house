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

## Quand créer une fiche ?

À chaque fois qu'on intègre un concept non-trivial qui :
- demande de lire de la doc externe pour le comprendre
- influence l'architecture (ex: registry pattern, RAG, OCR pipeline, observabilité)
- a fait l'objet d'un choix entre plusieurs options viables

Pas besoin de fiche pour les patterns évidents ou triviaux (CRUD, formulaire, etc.).
