- Créer `HouseholdDetailView` dans `apps/core/views.py`
  pour encapsuler le scoping household et éviter le boilerplate répété dans chaque vue.
  Voir `docs/REFACTO_HOUSEHOLD_DETAIL_VIEW.md`.

- Dans la page task, quand on ne met de date d'échéance, on ne peut créér de tache. Il semble y avoir un pb avec sur quoi la date d'échéance est mappé sur le model interaction. cette date d'échéance doit etre mappé sur le metadata due_date. d'ailleur occured_at ne dois pas etre obligatoire, ca n'a pas trop de sens pour une tache si ?

- Revoir le champs occured_at du modèle interaction. Voir où il est utilisé et si il est pertinent de le laisser (voir les migrations de données si c'est pas trop galère ou au moins pouvoir le laisser null)

- Revoir le mecansime avec la sidebar qui reload quand on change de page

- il y a un blink de la sidebar quand on recharge ou change de page

- Quand on est plus sur la page liste la _sidebar n'affiche plus sur quelle page on est

- On ne peut pas supprimer les tâches

- Enlever l'état isLoading sur les pages react

