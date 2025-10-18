- Revoir le design de la modal d'ajout de fichier la prévoir mobile first pour le moment des trucs depassent. 

- Migrer vers react hook form

- refaire la page stockage (storage) afin d'avoir une page ajout rapide de doucument : pour cela : supprime toute la page et le but ca sera d'implémenter le mecansime d'ajout de document rapide. Comme tu peux lire dans RESUME-PROJECT.md
🧠 User Story — “Ajout rapide d’un document”

🎯 Contexte

L’utilisateur veut simplement ajouter un fichier (photo, facture, devis, etc.) dans son espace, sans remplir de formulaire complexe ou créer explicitement une “interaction”.

⸻

🗣️ En tant qu’utilisateur

“Je veux pouvoir ajouter rapidement un document (photo, PDF, facture, etc.), et que l’application crée automatiquement le contexte associé, sans que j’aie à remplir tous les champs.”

⸻

✅ Critères d’acceptation
Critère
Description
📁 Upload simple
L’utilisateur peut glisser-déposer ou sélectionner un fichier depuis son appareil.
🧠 Création automatique
L’application crée automatiquement une interaction de type 'document' si aucune n’existe.
🏷️ Métadonnées basiques
L’interaction.subject = nom du fichier (sans extension)  type = 'document'  status = 'done' (ou 'archived' selon logique).
🧩 Lien automatique
Le document créé est lié à l’interaction générée.
🕵️ Option d’enrichissement
L’utilisateur peut ensuite ajouter (ou l’IA suggérer) un tag, une structure, un contact, ou une note.
🔒 Sécurité
Le champ household_id est automatiquement récupéré du contexte utilisateur (RLS).

