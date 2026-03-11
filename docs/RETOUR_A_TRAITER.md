- Dans la page task, quand on ne met de date d'échéance, on ne peut créér de tache. Il semble y avoir un pb avec sur quoi la date d'échéance est mappé sur le model interaction. cette date d'échéance doit etre mappé sur le metadata due_date. 

- Les données initiales de la page task ne sont pas fourni par django mais récupérées par react. 

- Revoir le systeme de page de base, j'ai fait généré le titre, description?, bouton d'action par le template django mais ce n'est peut etre pas le bon choix : il faudrait tout rendre l'ui par react : pour cela il faudrait retirer du template django titre, description, action pour ne laisser uniquement  à la place créer un template react commun avec titre, description et possibilité d'ajouter des boutton d'action. A faire dans la page task pour un essai.

- Revoir le champs occured_at du modèle interaction. Voir où il est utilisé et si il est pertinent de le laisser (voir les migrations de données si c'est pas trop galère ou au moins pouvoir le laisser null)