- Avoir une représentation visuelle du tableau
- Indiquer emplacement sur le tableau
- Pour les empty state : faire un peu une chaine : par exemple si il n'y a pas de circuit ni de breaker ni de tableau alors le empty state doit etre celui du tableau. Si il y a un tableau ca doit etre le protectedequipment et si il y en a un alors ca doit etre le circuit la. Tu vois ce que je veux dire ? Et ne pas afficher le boutton ajouter en haut à droite pour les empty state (applicable à toute l'appli)
- vu qu'on fait un soft delete il faut envoyer uniquement les non archivé (pareille partout dans l'appli)
- il y a un pb d'archi je crois : un disjoncteur doit pouvoir etre relié à un différentiel ou alors on met un parent ??
- un disjoncteur ou un différentiel peut etre triphasé ...
- c'est quoi emplacement de reserve ?
- position des breaker, diff sur tableau
- Revoir etiquette / nom pour les PU.
- Ne vaut-il pas générer les codes par le backend ou pas de code du tout ?
- regrouper ou pouvoir mettre des quantités au point d'usage : exemple salon toutes les prises x10 sur le meme circuit, relou de faire 10 PU
- pas de connexion sur le PU avec le circuit : si il y en a un mais bizarre peut etre mieux de le relier directement dans le form du PU ou sur le form du circuit pouvoir ajouter directement un PU
- demande de création de circuit quand on créé un breaker ou un combined
- virer la recherche pour le moment


amelioration : 
- Ajouter un champs marque (peut etre relié au module equipement)
- Si pas de tableau dans le foyer ne pas mettre de champs tableau parent. Ensuite à voir soit on envois rien et le back fait nul soit on envoi un champs nul (logique à répéter dans l'appli)
- section des fils et couleur avec recommandation en amond
- calculateur qui dit si notre circuit est au norme ou non par rapport à la puissance ect.
- pouvoir "brancher des equipements"
- relier equipements le model et breaker"
- boite de derivation en PU ??