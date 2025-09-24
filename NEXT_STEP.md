Lorsque l'utilisateur arrive sur '/app' une fois connecté, si il n'est pas relié à un household alors il faut un boutton pour en créer un : Reprendre le style utilisé et notamment la page /app/households/new 
le mieux je pense c'est de le charger dans le global context une fois l'user chargé ou alors rajouter une pripriété calculé à user qui dit si l'user a au moins un household. Si il en a plusieurs alors le but est de de faire choisir l'utilisateur.

Si je résume : l'user se connecte, si il n'a pas de household il est obligé d'en créé un, si il en a un seul -> got to dashboard sinon choisir le household et le mettre dans le global context
login -> création ou sélection du house hold si besoin -> redirection vers le dashboard