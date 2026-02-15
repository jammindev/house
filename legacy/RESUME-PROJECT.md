🧭 Contexte et Architecture de l’Application “House”
🎯 Objectif général
L’application House est un assistant personnel intelligent pour la gestion de la vie de foyer.
Elle sert à centraliser toutes les interactions, documents, tâches, dépenses, notes et échanges liés à un foyer (famille, maison, travaux, finances, etc.).
L’idée est de créer une base de mémoire contextuelle structurée qui permettra ensuite :
d’analyser automatiquement les activités du foyer,
d’enrichir les données avec des agents IA,
de construire progressivement des modules métiers (budget, projets, etc.)
sans casser l’existant.
🧱 1. Principes fondamentaux
💡 Philosophie
L’application repose sur une unité centrale universelle :
L’interaction, c’est-à-dire un événement, une action ou une trace de vie.
Chaque interaction peut ensuite être enrichie :
d’un contact (personne concernée),
d’une structure (entreprise, administration…),
de documents (devis, photos, factures…),
de tags, statuts, ou liens vers des projets.
Tout le reste (notes, tâches, emails, appels, dépenses, etc.) est une variation d’interaction.
🗂️ 2. Structure principale des données
2.1. households
Représente un foyer ou groupe de personnes.
Contient les informations de base du foyer.
Sert de clé étrangère commune pour toutes les autres entités.
Lié à household_members pour la gestion des utilisateurs.
2.2. interactions — Le cœur du système
Chaque ligne est un événement de vie :
une note, une tâche, un appel, un document reçu, une dépense, etc.
Champs principaux :
id, household_id
type: 'note', 'todo', 'call', 'meeting', 'document', 'expense', 'message', 'signature', 'other'
status: 'pending', 'in_progress', 'done', 'archived'
subject, content
date: moment de l’interaction
tags: catégories (travaux, banque, etc.)
contact_id / structure_id: lien optionnel vers une personne ou entreprise
metadata: champ jsonb pour les données spécifiques (montant, durée, lieu…)
Exemples :
Une note → type='note'
Une tâche → type='todo'
Une facture → type='expense'
Une signature chez le notaire → type='signature'
Un devis reçu → type='document' (avec fichiers liés)
2.3. documents
Table des fichiers et pièces jointes.
Chaque document est lié à une interaction.
Peut contenir : photos, factures, devis, PDF, etc.
Champs principaux :
type: 'photo', 'quote', 'invoice', 'contract', 'other'
file_url: lien vers Supabase Storage
name, notes, created_at
interaction_id: lien vers l’événement parent
Exemples :
Photo de chantier → type='photo'
Devis PDF → type='quote'
Facture finale → type='invoice'
2.4. contacts et structures
Deux tables distinctes pour les entités externes au foyer :
contacts → personnes (artisans, notaires, amis…)
structures → entreprises, mairies, banques, services publics…
Elles peuvent être liées à plusieurs interactions.
2.5. Tables associées
Table	Rôle
emails	adresses email liées à un contact ou une structure
phones	numéros de téléphone associés
addresses	adresses postales
household_members	membres du foyer ayant accès aux données
projects (optionnel futur)	pour regrouper plusieurs interactions dans un cadre commun (ex : “Travaux de chauffage”)
🧩 3. Relations principales
households
│
├── household_members
│
├── contacts
│    └── emails / phones / addresses
│
├── structures
│    └── emails / phones / addresses
│
├── interactions
│    ├── contact_id → contacts.id
│    ├── structure_id → structures.id
│    ├── project_id → projects.id (futur)
│    └── documents → documents.interaction_id
│
└── documents
🧠 4. Logique d’usage (User stories)
Exemple 1 — “J’ai reçu un devis”
L’utilisateur crée une interaction :
type = 'document'
subject = 'Devis pompe à chaleur'
structure_id = EcoTherm
Il ajoute 2 documents :
un quote.pdf
une fiche_technique.pdf
L’interaction et les fichiers sont liés automatiquement.
Exemple 2 — “Je veux ajouter une tâche”
Création d’une interaction type='todo' :
insert into interactions (type, subject, date, status)
values ('todo', 'Relancer EcoTherm', '2025-10-20', 'pending');
L’IA ou l’app peut rappeler les tâches selon status ou date.
Exemple 3 — “Je veux ajouter une note avec une photo”
Interaction type='note'
Ajout d’un document type='photo' (upload Supabase Storage)
Affichage : texte + miniature photo
💾 5. Sécurité et cohérence
Toutes les tables ont le champ household_id → données isolées par foyer
RLS activé : seuls les membres du foyer peuvent accéder à leurs données
Chaque table possède :
created_at, updated_at
created_by, updated_by
Trigger pour mise à jour auto de updated_at / updated_by
🧠 6. Évolutivité prévue
L’architecture permet d’ajouter facilement :
Module futur	Comment
Projets	table projects + clé project_id dans interactions
Budget / Dépenses	interactions avec type='expense' + metadata.amount
Suivi administratif	interactions de type 'document' ou 'todo'
Agenda / rappels	interactions.date + status
Analyse IA	embeddings sur subject, content, tags
Recherche sémantique	intégration d’un moteur de vecteurs
IA proactive	génération automatique de tâches / notes à partir de texte libre
⚙️ 7. Bénéfices du modèle
Avantage	Description
🧩 Cohérence	un seul modèle d’événement (interaction) pour tout
⚡ Simplicité	moins de tables, logique uniforme
🧠 Contextualisation IA	tout est lié : qui, quoi, quand, comment
🔍 Recherche unifiée	toutes les données passent par la même timeline
🧱 Évolutivité	ajouter un type ou module ≠ migration lourde
🔐 Sécurité	isolation par foyer + RLS fine
💬 Traçabilité	chaque action, fichier ou contact a un contexte clair
🔮 8. Vision long terme
Cette architecture forme la colonne vertébrale d’un assistant de vie intelligent :
capable de mémoriser, relier et raisonner sur toutes les actions du foyer ;
évoluant vers des modules d’automatisation (budget, calendrier, rappels) ;
et compatible avec une interface IA conversationnelle capable de retrouver, résumer ou créer des données à partir du langage naturel.
🧠 Exemple final
“Qu’ai-je fait pour le chauffage cette année ?”
→ L’IA cherche dans interactions :
type = document, todo, note, expense
tag = “travaux” ou structure = “EcoTherm”
Et peut répondre :
“Tu as reçu un devis de 4 200 € le 14 mars, signé le 20 avril, payé le 2 mai. Les travaux ont été terminés le 28 juin.”
