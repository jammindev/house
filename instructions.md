Contexte projet — Carnet de Maison (Next.js + Supabase)
🎯 Objectif
Mettre en place un carnet de maison centralisant toutes les infos utiles :
MVP : journal d’entrées avec pièces jointes, OCR et recherche plein texte.
Phase 2 : projets de rénovation, dashboard budget, rappels & maintenance.
📐 Choix de conception
Households
Chaque foyer (ex. toi + ta compagne) = un household.
Les données appartiennent à un household_id (et non à un utilisateur unique).
Permet le partage multi-utilisateurs dès le départ.
Household members
Table de lien entre auth.users et les households.
Gère les rôles (owner, member, guest à terme).
Base de toutes les policies RLS.
Zones
Liées à un household_id.
Chaque membre du household peut créer/modifier ses zones.
Les entries pourront être liées à une ou plusieurs zones.
RLS : seuls les membres du household voient / modifient les zones.
Entries
Journal d’entrées (texte brut utilisateur + enrichissement IA).
Champs principaux :
id (UUID, PK)
household_id (FK → households)
raw_text
enriched_text
metadata (jsonb : tags, type d’entrée, etc.)
created_at, created_by
updated_at, updated_by (maintenus par trigger)
RLS : seuls les membres du household accèdent aux entrées.
Entry_zones
Relation N-N entre entries et zones.
Clé primaire composée (entry_id, zone_id).
Version minimaliste (juste PK), possibilité d’ajouter created_at + created_by pour audit.
RLS basé sur le household de l’entrée.
Entry_files (🚧 à venir)
Fichiers joints liés à une entrée (images, PDF, factures…).
Schéma envisagé :
entry_id
storage_path
mime_type
ocr_text
metadata
created_at, created_by
updated_at, updated_by
Workflow futur : upload → OCR → enrichissement IA → mise à jour de l’entrée.
🛠️ Implémentation technique
Migrations créées
Dans supabase/migrations/ :
create_households.sql → table households.
create_household_members.sql → table de lien + policies. Ajoute la policy sur households qui utilise household_members.
create_zones.sql → table zones + RLS.
create_entries.sql → table entries + trigger update metadata.
create_entry_zones.sql → table de jointure entries ↔ zones.
Sécurité RLS
Activée sur toutes les tables :
households, household_members, zones, entries, entry_zones.
Policies : seuls les membres du household voient / modifient les données.
Scripts package.json
"scripts": {
  "db:migrate": "supabase migrations up --linked",
  "db:reset": "supabase db reset --linked",
  "db:new": "supabase migration new"
}
Installation du CLI
Via Homebrew (brew install supabase/tap/supabase).
Résultat actuel
✅ households
✅ household_members
✅ zones
✅ entries (avec updated_at + updated_by)
✅ entry_zones
🚧 entry_files (à venir)
🚧 Étapes suivantes
Implémenter entry_files.
Mettre en place OCR (Edge Function) + IA (function calling) pour enrichir et structurer les entrées.
Construire la recherche plein texte (search_vector + GIN index).
UI Next.js : /entries, /entries/new, /entries/[id].