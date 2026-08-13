"""Isolation multi-foyer — le contrôle qui ne se périme pas.

Un audit est vrai le jour où on le fait. Ce fichier est l'inverse : il parcourt
le **routeur DRF réel** et vérifie, pour chaque endpoint enregistré, que la
requête qu'il produit est bornée au foyer du demandeur. Ajouter un viewset non
scopé fait échouer ce test sans que personne ait à y penser — même mécanique que
``banking.compliance.REGISTRY`` (« ajouter un mécanisme à l'argent = ajouter son
détecteur ») ou que la parité des catalogues i18n.

Ce que ce test prouve et ne prouve pas
--------------------------------------

Il **prouve** qu'aucun endpoint enregistré ne construit une requête capable
d'atteindre un autre foyer. C'est la classe de faille la plus probable, et la
seule qui se glisse dans une revue sans se voir : le diff d'un ``get_queryset``
qui oublie le foyer ressemble exactement à celui qui le pose.

Il **ne prouve pas** l'absence de faille. Une action ``@action`` custom qui
ouvre son propre chemin, un fichier servi par son chemin, un tool d'agent : rien
de tout ça ne passe par un queryset. Ces surfaces ont leurs propres tests —
``test_media_isolation.py`` pour les fichiers, ``agent/tests/`` pour l'agent.
Ne jamais lire un succès ici comme un satisfecit général.
"""
import pytest
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.tests.factories import UserFactory
from core.introspection import dotted as _dotted
from core.introspection import registered_api_views as _registered_api_views
from core.models import HouseholdScopedModel
from households.models import Household, HouseholdMember

# ── Exemptions ───────────────────────────────────────────────────────────────
#
# Une exemption est une **dette nommée**, pas un contournement : chacune dit
# pourquoi l'endpoint n'est pas borné par un foyer, et ce qui le protège à la
# place. Sans justification, il n'y a pas de dispense — la liste est le seul
# endroit où un « oui mais c'est normal » se dépose, et il doit se relire.

EXEMPT_UNSCOPED = {
    # Modèle **global** et assumé (cf. CLAUDE.md § Changelog) : infra
    # applicative, pas donnée de foyer. Protégé par `IsAdminUser`, vérifié
    # ci-dessous par `test_the_global_endpoints_are_staff_only`.
    "releases.views.ChangelogViewSet",
}

EXEMPT_USER_SCOPED = {
    # Une notification appartient à une **personne**, pas à un foyer : deux
    # membres du même foyer n'ont pas la même liste. Borner par foyer serait
    # ici plus permissif, pas moins.
    "notifications.views.NotificationViewSet",
}

# Vues sans queryset (APIView, endpoints JWT) : ce test ne peut rien en dire.
# Elles ne sont pas dispensées de scoping — elles relèvent d'un autre contrôle.
SKIP_NO_QUERYSET = True


# Le parcours du routeur et le nom pointé vivent dans ``core.introspection`` :
# ``test_rate_limits.py`` s'appuie sur le **même**, et deux parcours écrits
# séparément auraient dérivé.


def _constraints_of(sql: str) -> str:
    """Ce qui *contraint* la requête : tout ce qui suit le premier ``FROM``.

    ⚠️ **Ne jamais chercher dans le SQL entier.** La liste de colonnes d'un
    ``SELECT`` sur un modèle household-scoped contient toujours
    ``"table"."household_id"`` : un test qui cherche « household » n'importe où
    passe donc au vert sur un ``Model.objects.all()`` sans le moindre ``WHERE``.
    Ce fichier a eu ce défaut, et il ne s'est vu qu'en sabotant volontairement
    un viewset pour vérifier que le test mordait. Un contrôle qu'on n'a pas vu
    échouer une fois n'est pas un contrôle.

    Ce qui suit le ``FROM`` couvre les conditions de jointure **et** le
    ``WHERE`` — les deux façons légitimes de borner au foyer (la jointure
    traverse souvent ``households_householdmember``).
    """
    lowered = sql.lower()
    marker = " from "
    index = lowered.find(marker)
    return lowered[index + len(marker):] if index != -1 else ""


@pytest.fixture
def two_households(db):
    """Deux foyers étanches, et un utilisateur dans chacun."""
    household_a = Household.objects.create(name="Foyer A")
    household_b = Household.objects.create(name="Foyer B")
    alice = UserFactory()
    bob = UserFactory()
    HouseholdMember.objects.create(
        household=household_a, user=alice, role=HouseholdMember.Role.OWNER
    )
    HouseholdMember.objects.create(
        household=household_b, user=bob, role=HouseholdMember.Role.OWNER
    )
    bob.active_household = household_b
    bob.save(update_fields=["active_household"])
    return household_a, household_b, alice, bob


def _queryset_for(cls, user, household):
    """Le queryset que ce viewset produirait pour ``user`` dans ``household``.

    On pose ``request.household`` à la main : c'est ce que fait
    ``ActiveHouseholdMiddleware``, et ce test porte sur les vues, pas sur lui.
    Le middleware a ses propres tests (``test_active_household_is_revoked``).
    """
    raw = APIRequestFactory().get("/api/probe/")
    force_authenticate(raw, user=user)
    raw.household = household
    request = Request(raw)
    request.user = user
    request.household = household

    view = cls()
    view.request = request
    view.format_kwarg = None
    view.kwargs = {}
    view.action = "list"
    return view.get_queryset()


@pytest.mark.django_db
class TestEveryRegisteredEndpointIsBoundToOneHousehold:
    """Le contrôle central : aucun endpoint ne peut atteindre un autre foyer."""

    def test_the_router_is_actually_discovered(self):
        """Garde-fou du garde-fou.

        Si la découverte casse (renommage d'URL, changement de routeur), le
        test principal passerait en ne vérifiant **rien**. Un contrôle qui ne
        contrôle plus rien et une absence d'écart se ressemblent trop.
        """
        views = _registered_api_views()
        assert len(views) > 50, (
            f"Seulement {len(views)} vues découvertes sous /api/ — la découverte "
            "est probablement cassée, pas le dépôt subitement plus petit."
        )

    def test_no_endpoint_escapes_its_household(self, two_households):
        household_a, household_b, _alice, bob = two_households

        escaping = []
        for cls in _registered_api_views():
            name = _dotted(cls)
            if name in EXEMPT_UNSCOPED or name in EXEMPT_USER_SCOPED:
                continue
            if not hasattr(cls, "get_queryset") and getattr(cls, "queryset", None) is None:
                continue

            try:
                queryset = _queryset_for(cls, bob, household_b)
                sql, params = queryset.query.sql_with_params()
            except AssertionError:
                # DRF lève quand la vue n'a ni queryset ni get_queryset
                # (endpoints JWT) : hors du périmètre de ce test.
                continue

            constraints = _constraints_of(sql)
            values = {str(p) for p in params}
            bound_by_household = "household" in constraints or str(household_b.id) in values
            bound_by_user = str(bob.id) in values or "user_id" in constraints

            if not (bound_by_household or bound_by_user):
                escaping.append(f"{name}  →  {queryset.model._meta.label}")

        assert not escaping, (
            "Ces endpoints produisent une requête qui n'est bornée ni par foyer "
            "ni par utilisateur — donc lisible par n'importe qui :\n  "
            + "\n  ".join(escaping)
            + "\n\nBorner le queryset, ou ajouter une exemption **justifiée** "
            "dans EXEMPT_UNSCOPED en haut de ce fichier."
        )

    def test_household_scoped_models_are_bound_by_household_not_merely_by_user(
        self, two_households
    ):
        """Un modèle de foyer se borne par foyer, jamais seulement par user.

        Borner par ``created_by`` sur une donnée de foyer paraît sûr et ne
        l'est pas : ça cache aux **autres membres** ce qui leur appartient
        aussi, et ça cesse de protéger dès qu'une ligne change de créateur.
        """
        _household_a, household_b, _alice, bob = two_households

        weakly_bound = []
        for cls in _registered_api_views():
            name = _dotted(cls)
            if name in EXEMPT_UNSCOPED or name in EXEMPT_USER_SCOPED:
                continue

            model = None
            queryset_attr = getattr(cls, "queryset", None)
            if queryset_attr is not None:
                model = queryset_attr.model
            else:
                meta = getattr(getattr(cls, "serializer_class", None), "Meta", None)
                model = getattr(meta, "model", None)
            if model is None or not issubclass(model, HouseholdScopedModel):
                continue

            try:
                queryset = _queryset_for(cls, bob, household_b)
                sql, params = queryset.query.sql_with_params()
            except AssertionError:
                continue

            if "household" not in _constraints_of(sql) and str(household_b.id) not in {
                str(p) for p in params
            }:
                weakly_bound.append(f"{name}  →  {model._meta.label}")

        assert not weakly_bound, (
            "Ces endpoints servent un modèle household-scoped sans borner par "
            "le foyer :\n  " + "\n  ".join(weakly_bound)
        )

    def test_the_global_endpoints_are_staff_only(self):
        """Ce qui est dispensé de foyer doit être protégé autrement.

        Une exemption sans contrepartie serait juste un trou avec un
        commentaire.
        """
        from rest_framework.permissions import IsAdminUser

        by_name = {_dotted(cls): cls for cls in _registered_api_views()}
        for name in EXEMPT_UNSCOPED:
            cls = by_name.get(name)
            assert cls is not None, (
                f"{name} est exempté mais n'existe plus — retirer l'exemption, "
                "sinon la liste protège un fantôme."
            )
            assert IsAdminUser in cls.permission_classes, (
                f"{name} n'est borné par aucun foyer : il doit rester réservé au "
                "staff, sinon l'exemption devient une faille."
            )


@pytest.mark.django_db
class TestLosingMembershipRevokesAccessImmediately:
    """``request.household`` vient de ``User.active_household``, sans revérifier.

    Le middleware charge le foyer actif par son id **sans** repasser par
    l'appartenance : la révocation ne tient donc qu'au signal ``post_delete``
    qui remet ce champ à zéro. C'est un invariant sur un fil, et un fil se coupe
    — un ``bulk_delete`` brut ou un `_raw_delete` le sectionnerait sans bruit.
    D'où ce test.
    """

    def test_removing_a_member_clears_their_active_household(self, two_households):
        household_a, _household_b, alice, _bob = two_households
        alice.refresh_from_db()
        assert str(alice.active_household_id) == str(household_a.id)

        HouseholdMember.objects.get(household=household_a, user=alice).delete()

        alice.refresh_from_db()
        assert alice.active_household_id is None, (
            "Un membre retiré garde son foyer actif : le middleware le "
            "resservirait, donc l'exclu continuerait de tout lire."
        )

    def test_a_queryset_delete_revokes_too(self, two_households):
        """La suppression en masse doit révoquer comme la suppression unitaire."""
        household_a, _household_b, alice, _bob = two_households

        HouseholdMember.objects.filter(household=household_a, user=alice).delete()

        alice.refresh_from_db()
        assert alice.active_household_id is None

    def test_a_member_of_two_households_falls_back_to_the_other(self, two_households):
        household_a, household_b, alice, _bob = two_households
        HouseholdMember.objects.create(
            household=household_b, user=alice, role=HouseholdMember.Role.MEMBER
        )

        HouseholdMember.objects.get(household=household_a, user=alice).delete()

        alice.refresh_from_db()
        assert str(alice.active_household_id) == str(household_b.id)
