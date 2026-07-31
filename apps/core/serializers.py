"""Champs de serializer partagés — le plancher d'isolation en écriture.

Une lecture mal bornée se voit : la liste montre ce qu'elle ne devrait pas.
Une **écriture** mal bornée ne se voit pas : elle réussit, l'utilisateur lit
« enregistré », et l'objet d'un autre foyer entre dans le graphe sans un mot.
L'entrée a donc besoin de son propre garde-fou — ``test_tenant_isolation`` ne
parcourt que les lectures.

Le défaut que ce module supprime n'était pas une faille : les cinq champs
concernés étaient tous rattrapés en aval. C'était **trois mécanismes différents
pour la même garantie** — un ``validate()`` de serializer, un
``validate_<champ>``, un ``perform_create`` de vue. Chacun juste, aucun garanti.
Une sixième FK écrite demain n'aurait rien eu par défaut, et rien ne l'aurait
signalé : le diff d'un champ protégé et celui d'un champ nu sont identiques.
"""
from rest_framework import serializers


class HouseholdScopedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """Une FK qui n'accepte que des objets d'un foyer accessible.

    Remplace ``PrimaryKeyRelatedField(queryset=Model.objects.all())``, qui
    accepte n'importe quel identifiant de n'importe quel foyer et s'en remet à
    une validation écrite ailleurs.

    ::

        from core.serializers import HouseholdScopedPrimaryKeyRelatedField as ScopedFK

        document = ScopedFK(model=Document)

    **C'est un plancher, pas un plafond.** Il garantit « l'objet est dans un
    foyer accessible » ; il ne dit rien de « les deux objets sont dans le *même*
    foyer », ni de « seul le créateur peut attacher ». Les validations existantes
    qui vérifient ça restent nécessaires — poser ce champ ne les remplace pas.

    Résolution du foyer, dans l'ordre :

    1. ``context['household_id']`` — les services métier construisent leurs
       serializers sans requête HTTP (ex. ``trackers.services.add_entry``) ;
    2. ``request.household`` — posé par ``ActiveHouseholdMiddleware`` ;
    3. à défaut, **tous les foyers de l'utilisateur** — un client qui n'a pas
       encore de foyer actif ;
    4. sinon, **rien**.

    Le point 4 est le comportement important : sans contexte exploitable, le
    champ n'accepte aucun identifiant. Un champ qui laisse passer quand il ne
    sait pas protège exactement tant que personne ne l'attaque.
    """

    def __init__(self, *, model, **kwargs):
        self.model = model
        # DRF exige un queryset dès la construction ; le vrai périmètre est
        # calculé par `get_queryset()`, qui a accès au contexte.
        kwargs.setdefault("queryset", model._default_manager.none())
        super().__init__(**kwargs)

    def get_queryset(self):
        base = self.model._default_manager.all()

        household_id = self.context.get("household_id")
        if household_id:
            return base.filter(household_id=household_id)

        request = self.context.get("request")
        household = getattr(request, "household", None)
        if household is not None:
            return base.filter(household_id=household.id)

        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            return base.filter(
                household_id__in=user.householdmember_set.values_list(
                    "household_id", flat=True
                )
            )

        return base.none()
